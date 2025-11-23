"use client"
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Search, Upload, ArrowLeft, Lock } from 'lucide-react';
import { useSelector } from 'react-redux';
import { doc, setDoc, collection, getDocs, deleteDoc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import jobjson from '@/jobCategories.json';
import { parseRegionAndSubRegion } from '@/lib/addressParser';
import { REGION_CODES } from '@/lib/localcode';

const JOB_CATEGORIES = jobjson;

// 접을 수 있는 섹션 컴포넌트 (컴포넌트 외부로 이동하여 리렌더링 방지)
const CollapsibleSection = React.memo(({ title, isExpanded, onToggle, children, badge = null }) => (
  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-4 md:px-6 py-4 md:py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <h3 className="text-base md:text-lg font-semibold text-gray-900">{title}</h3>
        {badge && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>
    {isExpanded && (
      <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-gray-100">
        {children}
      </div>
    )}
  </div>
));

export default function JobPostingManager() {
  const currentUser = useSelector((state) => state.user.currentUser);
  const [view, setView] = useState('list');
  const [jobList, setJobList] = useState([]);
  const [editingJobId, setEditingJobId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    requirements: '',
    preferredQualifications: '',
    responsibilities: '',
    benefits: '',
    welfare: '',
    jobType: '신입',
    selectedJobs: [],
    selectedSpecialties: [],
    searchKeywords: [], // 🔥 검색 키워드 필드 추가
    location: {
      address: '',
      detail: '',
      canWorkRemote: false
    },
    region: '', 
    subRegion: '',
    regionCode: '', // 🔥 지역 코드를 저장할 필드 추가
    education: '학력무관',
    positionLevels: [],
    positionRoles: [],
    salary: {
      type: '연봉',
      amount: '',
      unit: '만원'
    },
    workHours: {
      weeklyHours: 40
    },
    deadline: {
      type: '마감일 지정',
      startDate: '',
      startTime: '12시',
      endDate: '',
      endTime: '24시'
    },
    recruitTypes: [],
    applicationMethod: {
      type: '모두잡AI지원서',
      fileUrl: '',
      customUrl: ''
    },
    applicationSteps: ['서류전형', '1차면접', '2차면접', '최종합격'],
    submissionDocuments: '',
    notice: '',
    createdAt: null,
    updatedAt: null,
    userId: '',
    status: 'draft',
    isClosed: false  // 마감 여부 추가
  });

  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('기획·전략');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // 접을 수 있는 섹션들의 상태
  const [expandedSections, setExpandedSections] = useState({
    qualifications: false,
    benefits: false,
    welfare: false,
    documents: false,
    notice: false
  });

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // 한국어 입력 최적화를 위한 핸들러 함수들
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleNestedInputChange = useCallback((parentField, childField, value) => {
    setFormData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [childField]: value
      }
    }));
  }, []);

  const handleArrayToggle = useCallback((field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: toggleArrayItem(prev[field], item)
    }));
  }, []);

  const educationOptions = ['학력무관', '고등학교 졸업 이상', '대학 졸업(2,3년) 이상', '대학교 졸업(4년) 이상', '석사 졸업 이상', '박사 졸업'];
  const positionLevelOptions = ['인턴/수습', '사원', '주임', '계장', '대리', '과장', '차장', '부장', '감사', '이사', '상무', '전무', '부사장', '임원', '사장', '연구원', '주임연구원', '선임연구원', '책임연구원', '수석연구원', '연구소장', '면접 후 결정'];
  const positionRoleOptions = ['팀원', '팀장', '실장', '총무', '지점장', '지사장', '파트장', '그룹장', '센터장', '매니저', '본부장', '사업부장', '원장', '국장'];
  const recruitTypeOptions = ['정규직', '계약직', '프리랜서', '인턴직', '아르바이트', '파트', '위촉직', '파견직', '전임', '병역특례', '교육생', '해외취업'];
  const applicationMethodOptions = [
    { value: '모두잡AI지원서', label: '모두잡AI 지원서' },
    { value: '자사양식파일', label: '자사 양식(파일)' },
    { value: '자사양식URL', label: '자사 양식(URL)' },
    { value: '자유양식', label: '자유양식' }
  ];
  const salaryTypeOptions = ['연봉', '월급', '주급', '일급', '시급', '건당'];
  const timeOptions = ['00시', '06시', '12시', '18시', '24시'];

  useEffect(() => {
    if (currentUser?.uid) {
      loadJobList();
    }
  }, [currentUser]);

  const loadJobList = async () => {
    // 1. 현재 사용자 ID가 없는 경우 바로 종료
    const userId = currentUser?.uid;
    if (!userId) return;

    try {
        const jobsRef = collection(db, `jobs`);
        
        // 2. 쿼리 생성: jobs 컬렉션에서 userId 필드가 현재 사용자 ID와 같은 문서만 필터링
        const q = query(
            jobsRef, 
            where("userId", "==", userId)
        );

        // 3. 쿼리 실행
        const snapshot = await getDocs(q);

        const jobs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // 4. 최신순 정렬 (createdAt 필드 사용) 및 상태 업데이트
        setJobList(jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

    } catch (error) {
        console.error('목록 로딩 오류:', error);
    }
};

  // 네이버 주소 검색
  const handleAddressSearch = () => {
    const openDaumPostcode = (onComplete) => {
      new window.daum.Postcode({
        oncomplete: function(data) {
          const fullAddress = data.roadAddress || data.jibunAddress;
          const { region, subRegion } = parseRegionAndSubRegion(fullAddress);
          
          let regionCode = '';
          if (subRegion && REGION_CODES[`${region} ${subRegion}`]) {
            regionCode = REGION_CODES[`${region} ${subRegion}`];
          } else if (region && REGION_CODES[region]) {
            regionCode = REGION_CODES[region];
          }

          if (onComplete) {
            onComplete({
              address: fullAddress,
              region,
              subRegion,
              regionCode,
            });
          }
        }
      }).open();
    };

    if (!window.daum || !window.daum.Postcode) {
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      document.head.appendChild(script);
      script.onload = () => {
        openDaumPostcode((data) => {
          setFormData(prev => ({
            ...prev,
            location: { ...prev.location, address: data.address },
            region: data.region,
            subRegion: data.subRegion,
            regionCode: data.regionCode,
          }));
        });
      }
    } else {
      openDaumPostcode((data) => {
        setFormData(prev => ({
          ...prev,
          location: { ...prev.location, address: data.address },
          region: data.region,
          subRegion: data.subRegion,
          regionCode: data.regionCode,
        }));
      });
    }
  };


// 2. 현재 위치로 주소 검색하는 함수 추가
const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
        alert('현재 브라우저에서는 위치 서비스를 지원하지 않습니다.');
        return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const ADDRESS_API_BASE = process.env.NEXT_PUBLIC_ADDRESS_API_URL;
                if (!ADDRESS_API_BASE) throw new Error("주소 API URL이 설정되지 않았습니다.");
                const url = `${ADDRESS_API_BASE}/api/coord-to-address?x=${longitude}&y=${latitude}`;
                
                const response = await fetch(url, {
                    method: 'GET'
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    // 가져온 주소
                    const fullAddress = data.address.roadAddress || data.address.jibunAddress;
                    
                    // 🔥 주소에서 region 및 subRegion 추출
                    const { region, subRegion } = parseRegionAndSubRegion(fullAddress);
                    
                    // 🔥 regionCode 생성 로직 - subRegion이 REGION_CODES에 있으면 해당 코드 저장
                    let regionCode = '';
                    if (subRegion && REGION_CODES[`${region} ${subRegion}`]) {
                      regionCode = REGION_CODES[`${region} ${subRegion}`];
                    } else if (region && REGION_CODES[region]) {
                      regionCode = REGION_CODES[region];
                    }

                    setFormData({
                        ...formData,
                        location: {
                            ...formData.location,
                            address: fullAddress // 전체 주소 저장
                        },
                        // 🔥 추출한 region과 subRegion 저장
                        region: region, 
                        subRegion: subRegion,
                        regionCode: regionCode, // 🔥 지역 코드 저장
                    });
                    alert(`현재 위치의 주소 (${region} ${subRegion})를 가져왔습니다.`);
                } else {
                    alert(data.message || '주소를 가져오는데 실패했습니다.');
                }
            } catch (error) {
                console.error('현재 위치 오류:', error);
                alert('현재 위치를 가져오는데 실패했습니다.');
            } finally {
                setIsGettingLocation(false);
            }
        },
        (error) => {
            console.error('위치 권한 오류:', error);
            alert('위치 권한을 허용해주세요.');
            setIsGettingLocation(false);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

  // 공고 마감 처리
  const handleCloseJob = async (jobId) => {
    if (!confirm('이 공고를 마감하시겠습니까? 마감된 공고는 지원자가 볼 수 없습니다.')) return;
    
    try {
      await updateDoc(doc(db, `jobs`, jobId), {
        isClosed: true,
        closedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      alert('공고가 마감되었습니다.');
      loadJobList();
    } catch (error) {
      console.error('마감 처리 오류:', error);
      alert('마감 처리 중 오류가 발생했습니다.');
    }
  };

  // 공고 재개 처리
  const handleReopenJob = async (jobId) => {
    if (!confirm('이 공고를 다시 게시하시겠습니까?')) return;
    
    try {
      await updateDoc(doc(db, `jobs`, jobId), {
        isClosed: false,
        closedAt: null,
        updatedAt: new Date().toISOString()
      });
      alert('공고가 다시 게시되었습니다.');
      loadJobList();
    } catch (error) {
      console.error('재개 처리 오류:', error);
      alert('재개 처리 중 오류가 발생했습니다.');
    }
  };

  const toggleArrayItem = (array, item) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      // TODO: Firebase Storage에 업로드
    }
  };

  const generateDocumentId = () => {
    return `${Date.now()}`;
  };

  const handleSubmit = async () => {
    if (!currentUser?.uid) {
      alert('로그인이 필요합니다.');
      return;
    }

    const docId = editingJobId || generateDocumentId();
    
    // 보안 강화: 클라이언트 측에서 formData가 조작되었을 가능성에 대비하여,
    // 인증된 사용자의 uid로 userId를 덮어씁니다.
    const submitData = {
      ...formData,
      userId: currentUser.uid, // 누락된 userId 추가
      createdAt: editingJobId ? formData.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentId: docId,
      regionCode: formData.regionCode, // 🔥 regionCode가 포함된 formData를 사용하므로 자동 포함됨
      status: 'published',
      searchKeywords: generateSearchKeywords(formData) // 🔥 생성된 키워드 추가
    };

    try {
      await setDoc(doc(db, `jobs`, docId), submitData);
      alert('공고가 등록되었습니다!');
      setView('list');
      loadJobList();
      resetForm();
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    }
  };

  // 🔥 검색 키워드 생성 로직을 별도 함수로 추출
  const generateSearchKeywords = (data) => {
    const keywordSet = new Set();

    // 1. 선택된 직무와 전문분야를 키워드에 추가
    [...(data.selectedJobs || []), ...(data.selectedSpecialties || [])].forEach(item => {
      if (item) {
        keywordSet.add(item.toLowerCase());
      }
    });

    return Array.from(keywordSet);
  };

  const handleSaveDraft = async () => {
    if (!currentUser?.uid) {
      alert('로그인이 필요합니다.');
      return;
    }

    const docId = editingJobId || generateDocumentId();

    const draftData = {
      ...formData,
      status: 'draft',
      createdAt: editingJobId ? formData.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser.uid,
      documentId: docId,
      regionCode: formData.regionCode, // 🔥 regionCode가 포함된 formData를 사용하므로 자동 포함됨
      searchKeywords: generateSearchKeywords(formData) // 🔥 생성된 키워드 추가
    };

    try {
      await setDoc(doc(db, `jobs`, docId), draftData);
      alert('임시저장되었습니다!');
      setView('list');
      loadJobList();
    } catch (error) {
      console.error('임시저장 오류:', error);
      alert('임시저장 중 오류가 발생했습니다.');
    }
  };

  const handleEdit = async (jobId) => {
    try {
      const jobDoc = await getDoc(doc(db, `jobs`, jobId));
      if (jobDoc.exists()) {
        setFormData(jobDoc.data());
        setEditingJobId(jobId);
        setView('form');
      }
    } catch (error) {
      console.error('불러오기 오류:', error);
      alert('공고를 불러오는데 실패했습니다.');
    }
  };

  const handleDelete = async (jobId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await deleteDoc(doc(db, `jobs`, jobId));
      alert('삭제되었습니다.');
      loadJobList();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      requirements: '',
      preferredQualifications: '',
      responsibilities: '',
      benefits: '',
      welfare: '',
      jobType: '신입',
      selectedJobs: [],
      selectedSpecialties: [],
      searchKeywords: [],
      location: { address: '', detail: '', canWorkRemote: false },
      region: '', 
      regionCode: '',
      subRegion: '',
      education: '학력무관',
      positionLevels: [],
      positionRoles: [],
      salary: { type: '연봉', amount: '', unit: '만원' },
      workHours: { weeklyHours: 40 },
      deadline: { type: '마감일 지정', startDate: '', startTime: '12시', endDate: '', endTime: '24시' },
      recruitTypes: [],
      applicationMethod: { type: '모두잡AI지원서', fileUrl: '', customUrl: '' },
      applicationSteps: ['서류전형', '1차면접', '2차면접', '최종합격'],
      submissionDocuments: '',
      notice: '',
      createdAt: null,
      updatedAt: null,
      userId: '',
      status: 'draft',
      isClosed: false
    });
    setEditingJobId(null);
  };

  const currentCategory = JOB_CATEGORIES[selectedCategory] || {};

  // 목록 화면
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-4 md:py-8">
        <div className="max-w-7xl mx-auto px-3 md:px-6">
          {/* 헤더 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">채용 공고 관리</h1>
                  <p className="text-gray-600 text-sm md:text-base">등록된 공고를 관리하고 새로운 공고를 작성하세요</p>
                </div>
              </div>
              <button
                onClick={() => { resetForm(); setView('form'); }}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-3 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                ✨ 새 공고 등록
              </button>
            </div>
          </div>

          {jobList.length === 0 ? (
            /* 빈 상태 */
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">아직 등록된 채용공고가 없습니다</h3>
              <p className="text-gray-600 mb-8 text-sm md:text-base max-w-md mx-auto">
                첫 번째 채용공고를 등록하여 우수한 인재를 찾아보세요! 간단한 몇 단계로 전문적인 공고를 작성할 수 있습니다.
              </p>
              <button
                onClick={() => setView('form')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-3 mx-auto"
              >
                <Plus className="w-5 h-5" />
                🚀 첫 공고 등록하기
              </button>
            </div>
          ) : (
            /* 공고 목록 */
            <div className="space-y-6">
              {/* 통계 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{jobList.length}</p>
                      <p className="text-xs text-gray-600">전체 공고</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{jobList.filter(job => job.status === 'published' && !job.isClosed).length}</p>
                      <p className="text-xs text-gray-600">게시중</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{jobList.filter(job => job.status === 'draft').length}</p>
                      <p className="text-xs text-gray-600">임시저장</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Lock className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{jobList.filter(job => job.isClosed).length}</p>
                      <p className="text-xs text-gray-600">마감</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 공고 카드 그리드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {jobList.map(job => (
                  <div key={job.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 overflow-hidden">
                    {/* 카드 헤더 */}
                    <div className="p-6 pb-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-4">
                          <h3 className="font-bold text-lg md:text-xl text-gray-900 line-clamp-2 mb-2 leading-tight">
                            {job.title || '제목 없음'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
                              {job.jobType}
                            </span>
                            <span className="text-gray-400">•</span>
                            <span>{job.education}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                            job.status === 'published' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {job.status === 'published' ? (
                              <>
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                게시중
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                임시저장
                              </>
                            )}
                          </span>
                          {job.isClosed && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              마감
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
                        {job.requirements || '요구사항이 설정되지 않았습니다.'}
                      </p>

                      {/* 추가 정보 */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '날짜 없음'}
                        </div>
                        {job.salary?.amount && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            {job.salary.type} {job.salary.amount}만원
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="px-6 pb-6">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleEdit(job.id)}
                          className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          수정
                        </button>
                        {!job.isClosed ? (
                          <button
                            onClick={() => handleCloseJob(job.id)}
                            className="px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            마감
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReopenJob(job.id)}
                            className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                            </svg>
                            재개
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }


  // 폼 화면
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-4 md:py-8">
      <div className="max-w-4xl mx-auto px-3 md:px-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => setView('list')}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {editingJobId ? '채용 공고 수정' : '채용 공고 등록'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                필수 정보를 입력하고 추가 정보는 선택적으로 작성하세요
              </p>
            </div>
          </div>
        </div>

        {/* 필수 정보 섹션 */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">필수 정보</h2>
            <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              Required
            </span>
          </div>

          <div className="space-y-6 md:space-y-8">
            {/* 공고제목 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                공고제목
                <span className="text-red-500 text-xs">*</span>
              </label>
              <input
                type="text"
                placeholder="예: 경영기획실 IR담당 경력자 모집"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
              />
            </div>

            {/* 요망자격 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                요망자격
                <span className="text-red-500 text-xs">*</span>
              </label>
              <input
                type="text"
                placeholder="예: JAVA 백엔드 개발자, 마케팅 전문가"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.requirements}
                onChange={(e) => handleInputChange('requirements', e.target.value)}
                maxLength={30}
              />
              <p className="text-xs text-gray-500 mt-1">최대 30자까지 입력 가능</p>
            </div>

            {/* 직무·직업 선택 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                직무·직업
                <span className="text-red-500 text-xs">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowJobModal(true)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-left hover:bg-gray-50 flex items-center justify-between text-sm md:text-base transition-colors bg-gray-50 hover:border-blue-300"
              >
                <span className={`${(formData.selectedJobs.length + formData.selectedSpecialties.length) > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {(formData.selectedJobs.length + formData.selectedSpecialties.length) > 0 
                    ? `${formData.selectedJobs.length + formData.selectedSpecialties.length}개 직무 선택됨` 
                    : '직무·직업을 선택하세요'}
                </span>
                <Search className="w-5 h-5 text-gray-400" />
              </button>
              
              {(formData.selectedJobs.length > 0 || formData.selectedSpecialties.length > 0) && (
                <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-medium text-blue-800 mb-2">선택된 직무</p>
                  <div className="flex flex-wrap gap-2">
                    {formData.selectedJobs.map(job => (
                      <span key={job} className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs md:text-sm flex items-center gap-2 font-medium">
                        {job}
                        <button 
                          onClick={() => setFormData({...formData, selectedJobs: toggleArrayItem(formData.selectedJobs, job)})}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {formData.selectedSpecialties.map(spec => (
                      <span key={spec} className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs md:text-sm flex items-center gap-2 font-medium">
                        {spec}
                        <button 
                          onClick={() => setFormData({...formData, selectedSpecialties: toggleArrayItem(formData.selectedSpecialties, spec)})}
                          className="hover:bg-green-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 주요업무 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                주요업무
                <span className="text-red-500 text-xs">*</span>
              </label>
              <textarea
                placeholder="• 담당제품 프로젝트의 마케팅 전략 수립&#10;• 시장 분석 및 경쟁사 동향 파악&#10;• 브랜드 포지셔닝 및 커뮤니케이션 전략 개발"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 md:h-36 resize-none text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.responsibilities}
                onChange={(e) => handleInputChange('responsibilities', e.target.value)}
                maxLength={3000}
              />
              <p className="text-xs text-gray-500 mt-1">최대 3,000자까지 입력 가능</p>
            </div>

            {/* 경력 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                경력
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['신입', '경력', '경력무관'].map(type => (
                  <label key={type} className="relative cursor-pointer">
                    <input
                      type="radio"
                      value={type}
                      checked={formData.jobType === type}
                      onChange={(e) => setFormData({...formData, jobType: e.target.value})}
                      className="sr-only"
                    />
                    <div className={`p-3 rounded-xl border-2 text-center transition-all ${
                      formData.jobType === type 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}>
                      <span className="font-medium text-sm md:text-base">{type}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>


            {/* 학력 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                학력
                <span className="text-red-500 text-xs">*</span>
              </label>
              <select 
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.education}
                onChange={(e) => setFormData({...formData, education: e.target.value})}
              >
                {educationOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>

              {/* 직급 */}
              <div className="mt-6">
                <div className="text-sm font-medium text-gray-700 mb-3">직급 (선택사항)</div>
                <div className="border-2 border-gray-200 rounded-xl p-4 max-h-40 overflow-y-auto bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {positionLevelOptions.map(level => (
                      <label key={level} className="flex items-center cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.positionLevels.includes(level)}
                          onChange={() => setFormData({
                            ...formData,
                            positionLevels: toggleArrayItem(formData.positionLevels, level)
                          })}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs md:text-sm">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 직책 */}
              <div className="mt-6">
                <div className="text-sm font-medium text-gray-700 mb-3">직책 (선택사항)</div>
                <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {positionRoleOptions.map(role => (
                      <label key={role} className="flex items-center cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.positionRoles.includes(role)}
                          onChange={() => setFormData({
                            ...formData,
                            positionRoles: toggleArrayItem(formData.positionRoles, role)
                          })}
                          className="mr-2 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs md:text-sm">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 고용형태 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                고용형태
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {recruitTypeOptions.map(type => (
                  <label key={type} className="relative cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.recruitTypes.includes(type)}
                      onChange={() => setFormData({
                        ...formData,
                        recruitTypes: toggleArrayItem(formData.recruitTypes, type)
                      })}
                      className="sr-only"
                    />
                    <div className={`p-3 rounded-xl border-2 text-center transition-all ${
                      formData.recruitTypes.includes(type)
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                    }`}>
                      <span className="font-medium text-xs md:text-sm">{type}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 급여 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                급여
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 items-center">
                  <select 
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                    value={formData.salary.type}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: {...formData.salary, type: e.target.value}
                    })}
                  >
                    {salaryTypeOptions.map(type => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="금액 입력"
                    className="flex-1 min-w-[120px] px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                    value={formData.salary.amount}
                    onChange={(e) => setFormData({
                      ...formData,
                      salary: {...formData.salary, amount: parseInt(e.target.value) || 0}
                    })}
                  />
                  <span className="text-sm md:text-base font-medium text-gray-700">만원</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <span className="text-sm font-medium text-blue-800">주간 근무시간</span>
                  <input 
                    type="number" 
                    value={formData.workHours.weeklyHours}
                    onChange={(e) => setFormData({
                      ...formData,
                      workHours: {weeklyHours: parseInt(e.target.value) || 40}
                    })}
                    className="w-20 px-3 py-2 border-2 border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:ring-0 bg-white" 
                  />
                  <span className="text-sm font-medium text-blue-800">시간</span>
                </div>
              </div>
            </div>

            {/* 근무지 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                근무지
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="아래 버튼을 눌러 주소를 검색하세요"
                    value={formData.location.address}
                    readOnly
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                  />
                  <input
                    type="text"
                    placeholder="상세주소"
                    value={formData.location.detail}
                    onChange={(e) => handleNestedInputChange('location', 'detail', e.target.value)}
                    className="w-full md:w-32 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <button 
                    type="button"
                    onClick={handleAddressSearch}
                    disabled={isSearching}
                    className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 text-sm md:text-base disabled:bg-gray-400 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {isSearching ? '검색중...' : '🔍 주소검색'}
                  </button>
                  <button 
                    type="button"
                    onClick={handleCurrentLocation}
                    disabled={isGettingLocation}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm md:text-base disabled:bg-gray-400 flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    {isGettingLocation ? (
                      '위치 가져오는 중...'
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        📍 현재 위치
                      </>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                  <input
                    type="checkbox"
                    checked={formData.location.canWorkRemote}
                    onChange={(e) => setFormData({
                      ...formData,
                      location: {...formData.location, canWorkRemote: e.target.checked}
                    })}
                    className="text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-green-800">재택근무 가능</span>
                </div>
                <p className="text-xs text-gray-500">
                  💡 주소 검색이 작동하지 않으면 직접 입력해주세요
                </p>
              </div>
            </div>




            {/* 마감일 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                마감일
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="space-y-4">
                <select 
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                  value={formData.deadline.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    deadline: {...formData.deadline, type: e.target.value}
                  })}
                >
                  <option>마감일 지정</option>
                  <option>채용시 마감</option>
                  <option>상시채용</option>
                </select>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">시작일</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-0 bg-gray-50 focus:bg-white"
                        value={formData.deadline.startDate}
                        onChange={(e) => setFormData({
                          ...formData,
                          deadline: {...formData.deadline, startDate: e.target.value}
                        })}
                      />
                      <select 
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-0 bg-gray-50 focus:bg-white"
                        value={formData.deadline.startTime}
                        onChange={(e) => setFormData({
                          ...formData,
                          deadline: {...formData.deadline, startTime: e.target.value}
                        })}
                      >
                        {timeOptions.map(time => <option key={time}>{time}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">종료일</label>
                    <div className="flex gap-2">
                      <input 
                        type="date" 
                        className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-0 bg-gray-50 focus:bg-white"
                        value={formData.deadline.endDate}
                        onChange={(e) => setFormData({
                          ...formData,
                          deadline: {...formData.deadline, endDate: e.target.value}
                        })}
                      />
                      <select 
                        className="px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-0 bg-gray-50 focus:bg-white"
                        value={formData.deadline.endTime}
                        onChange={(e) => setFormData({
                          ...formData,
                          deadline: {...formData.deadline, endTime: e.target.value}
                        })}
                      >
                        {timeOptions.map(time => <option key={time}>{time}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 지원방법 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                지원방법
                <span className="text-red-500 text-xs">*</span>
              </label>
              <div className="space-y-4">
                <select 
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                  value={formData.applicationMethod.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    applicationMethod: {...formData.applicationMethod, type: e.target.value}
                  })}
                >
                  {applicationMethodOptions.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>

                {formData.applicationMethod.type === '자사양식파일' && (
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label 
                      htmlFor="file-upload"
                      className="flex items-center justify-center gap-3 px-4 py-3 border-2 border-dashed border-blue-300 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors text-sm md:text-base"
                    >
                      <Upload className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-800">
                        {uploadedFile ? uploadedFile.name : '📄 파일 선택'}
                      </span>
                    </label>
                  </div>
                )}

                {formData.applicationMethod.type === '자사양식URL' && (
                  <input
                    type="url"
                    placeholder="지원서 URL을 입력하세요 (예: https://company.com/apply)"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                    value={formData.applicationMethod.customUrl}
                    onChange={(e) => setFormData({
                      ...formData,
                      applicationMethod: {...formData.applicationMethod, customUrl: e.target.value}
                    })}
                  />
                )}
              </div>
            </div>

            {/* 채용절차 */}
            <div className="group">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                채용절차
                <span className="text-xs text-gray-500">(선택사항)</span>
              </label>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex flex-wrap gap-3 items-center">
                  {formData.applicationSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => {
                            const newSteps = [...formData.applicationSteps];
                            newSteps[index] = e.target.value;
                            setFormData({...formData, applicationSteps: newSteps});
                          }}
                          className="bg-transparent border-none focus:outline-none w-20 md:w-28 text-xs md:text-sm font-medium"
                          placeholder="단계명"
                        />
                        <button 
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            applicationSteps: formData.applicationSteps.filter((_, i) => i !== index)
                          })}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {index < formData.applicationSteps.length - 1 && (
                        <span className="text-blue-400 font-bold">→</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      applicationSteps: [...formData.applicationSteps, '새 단계']
                    })}
                    className="px-4 py-2 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">단계 추가</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 선택 정보 섹션 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">추가 정보</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Optional
            </span>
          </div>

          {/* 자격조건 */}
          <CollapsibleSection
            title="자격조건"
            isExpanded={expandedSections.qualifications}
            onToggle={() => toggleSection('qualifications')}
            badge="선택사항"
          >
            <div className="pt-4">
              <textarea
                placeholder="• Google Analytics 활용 가능&#10;• 관련 분야 경력 3년 이상&#10;• 영어 회화 가능자 우대"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 resize-none text-sm md:text-base focus:border-green-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.preferredQualifications}
                onChange={(e) => handleInputChange('preferredQualifications', e.target.value)}
                maxLength={3000}
              />
              <p className="text-xs text-gray-500 mt-2">최대 3,000자까지 입력 가능</p>
            </div>
          </CollapsibleSection>

          {/* 우대사항 */}
          <CollapsibleSection
            title="우대사항"
            isExpanded={expandedSections.benefits}
            onToggle={() => toggleSection('benefits')}
            badge="선택사항"
          >
            <div className="pt-4">
              <textarea
                placeholder="• 자기주도적 업무 지향&#10;• 팀워크 및 커뮤니케이션 능력 우수&#10;• 관련 자격증 보유자"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 resize-none text-sm md:text-base focus:border-green-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.benefits}
                onChange={(e) => handleInputChange('benefits', e.target.value)}
                maxLength={3000}
              />
              <p className="text-xs text-gray-500 mt-2">최대 3,000자까지 입력 가능</p>
            </div>
          </CollapsibleSection>

          {/* 복지혜택 */}
          <CollapsibleSection
            title="복지·혜택"
            isExpanded={expandedSections.welfare}
            onToggle={() => toggleSection('welfare')}
            badge="선택사항"
          >
            <div className="pt-4">
              <textarea
                placeholder="• 사내카페 무료 이용&#10;• 복지카드 지급&#10;• 건강검진 지원&#10;• 교육비 지원"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 resize-none text-sm md:text-base focus:border-green-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.welfare}
                onChange={(e) => handleInputChange('welfare', e.target.value)}
                maxLength={3000}
              />
              <p className="text-xs text-gray-500 mt-2">최대 3,000자까지 입력 가능</p>
            </div>
          </CollapsibleSection>

          {/* 제출서류 */}
          <CollapsibleSection
            title="제출서류"
            isExpanded={expandedSections.documents}
            onToggle={() => toggleSection('documents')}
            badge="선택사항"
          >
            <div className="pt-4">
              <input
                type="text"
                placeholder="예: 이력서, 자기소개서, 포트폴리오, 경력증명서"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-green-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.submissionDocuments}
                onChange={(e) => handleInputChange('submissionDocuments', e.target.value)}
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-2">최대 300자까지 입력 가능</p>
            </div>
          </CollapsibleSection>

          {/* 유의사항 */}
          <CollapsibleSection
            title="유의사항"
            isExpanded={expandedSections.notice}
            onToggle={() => toggleSection('notice')}
            badge="선택사항"
          >
            <div className="pt-4">
              <textarea
                placeholder="• 서류 합격자에게 개별 연락드립니다&#10;• 허위 기재 시 채용이 취소될 수 있습니다&#10;• 제출된 서류는 반환되지 않습니다"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl h-32 resize-none text-sm md:text-base focus:border-green-500 focus:ring-0 transition-colors bg-gray-50 focus:bg-white"
                value={formData.notice}
                onChange={(e) => handleInputChange('notice', e.target.value)}
                maxLength={3000}
              />
              <p className="text-xs text-gray-500 mt-2">최대 3,000자까지 입력 가능</p>
            </div>
          </CollapsibleSection>
        </div>

        {/* 제출 버튼 */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 text-sm md:text-base font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              💾 임시저장
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 text-sm md:text-base font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {editingJobId ? '✅ 수정 완료' : '🚀 공고 등록하기'}
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            💡 임시저장하면 나중에 이어서 작성할 수 있습니다
          </p>
        </div>
      </div>

      {/* 직무 선택 모달 */}
      {showJobModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-gray-900">직무·직업 선택</h2>
                  <p className="text-sm text-gray-600 mt-1">원하는 직무를 선택하세요</p>
                </div>
                <button 
                  onClick={() => setShowJobModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="직무·직업을 검색하세요 (예: 개발자, 디자이너)"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm md:text-base focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                  value={jobSearchTerm}
                  onChange={(e) => setJobSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r overflow-y-auto bg-gradient-to-b from-gray-50 to-gray-100 max-h-64 md:max-h-none">
                {Object.keys(JOB_CATEGORIES).map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full px-4 md:px-6 py-3 md:py-4 text-left hover:bg-white transition-all duration-200 text-sm md:text-base ${
                      selectedCategory === category 
                        ? 'bg-white text-blue-600 font-semibold border-l-4 border-blue-600 shadow-sm' 
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-3 md:p-6">
                {Object.keys(currentCategory).map((key) => {
                  const items = currentCategory[key] || [];
                  if (!Array.isArray(items) || items.length === 0) return null;
                  
                  const labelMap = {
                    jobs: '직무·직업',
                    specialties: '전문분야',
                    techStack: '기술스택',
                    tools: '작업도구',
                    workplaces: '근무장소',
                    workTypes: '근무형태',
                    professionals: '의료전문직',
                    staff: '의료종사직',
                    departments: '진료과',
                    vehicles: '운송수단',
                    equipment: '중장비',
                    subjects: '교육과목',
                    institutions: '금융기관'
                  };

                  const label = labelMap[key] || key;
                  
                  const filteredItems = jobSearchTerm
                    ? items.filter(item => item.toLowerCase().includes(jobSearchTerm.toLowerCase()))
                    : items;

                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={key} className="mb-6 md:mb-8">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        {label}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                        {filteredItems.map(item => {
                          const isSelected = key === 'jobs' 
                            ? formData.selectedJobs.includes(item)
                            : formData.selectedSpecialties.includes(item);
                          
                          return (
                            <label key={item} className={`flex items-center cursor-pointer p-3 rounded-xl border-2 transition-all duration-200 ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (key === 'jobs') {
                                    // selectedJobs 3개 제한
                                    if (!isSelected && formData.selectedJobs.length >= 3) {
                                      alert('직무는 최대 3개까지 선택할 수 있습니다.');
                                      return;
                                    }
                                    setFormData({
                                      ...formData,
                                      selectedJobs: toggleArrayItem(formData.selectedJobs, item)
                                    });
                                  } else {
                                    // selectedSpecialties 7개 제한
                                    if (!isSelected && formData.selectedSpecialties.length >= 7) {
                                      alert('전문분야는 최대 7개까지 선택할 수 있습니다.');
                                      return;
                                    }
                                    setFormData({
                                      ...formData,
                                      selectedSpecialties: toggleArrayItem(formData.selectedSpecialties, item)
                                    });
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className="text-xs md:text-sm font-medium">{item}</span>
                              {isSelected && (
                                <svg className="w-4 h-4 ml-auto text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {Object.keys(currentCategory).every(key => {
                  const items = currentCategory[key] || [];
                  if (!Array.isArray(items)) return true;
                  const filtered = jobSearchTerm
                    ? items.filter(item => item.toLowerCase().includes(jobSearchTerm.toLowerCase()))
                    : items;
                  return filtered.length === 0;
                }) && (
                  <p className="text-gray-500 text-sm text-center py-8">검색 결과가 없습니다.</p>
                )}
              </div>
            </div>

            <div className="p-4 md:p-6 border-t bg-gradient-to-r from-gray-50 to-blue-50">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-700 bg-white px-4 py-2 rounded-lg shadow-sm">
                  <span className="font-semibold text-blue-600">선택됨: </span>
                  직무 <span className="font-bold text-blue-600">{formData.selectedJobs.length}/3</span>개, 
                  전문분야 <span className="font-bold text-green-600">{formData.selectedSpecialties.length}/7</span>개
                  <span className="text-xs text-gray-500 ml-2">(총 {formData.selectedJobs.length + formData.selectedSpecialties.length}/10개)</span>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setFormData({
                        ...formData,
                        selectedJobs: [],
                        selectedSpecialties: []
                      });
                    }}
                    className="flex-1 md:flex-none px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-colors text-sm md:text-base font-medium"
                  >
                    🗑️ 초기화
                  </button>
                  <button
                    onClick={() => setShowJobModal(false)}
                    className="flex-1 md:flex-none px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm md:text-base font-semibold shadow-lg transition-all duration-200"
                  >
                    ✅ 선택완료
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}