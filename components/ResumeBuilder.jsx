'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Trash2, Upload, Download, Plus, Sparkles, Save, X, Globe, Award, Monitor, Star, Briefcase, Camera, Search, ArrowLeft, Eye, EyeOff, MapPin, Clock, DollarSign, Calendar, GraduationCap, Link as LinkIcon, BookOpen, User, Mail, Phone, Heart, Settings } from 'lucide-react';

import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { db, storage } from '@/firebase';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { ref as strRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import jsPDF from 'jspdf'; 
import html2canvas from 'html2canvas-pro';
import jobjson from '@/jobCategories.json';
import { hierarchicalRegions } from '@/lib/region';
import { REGION_CODES } from '@/lib/localcode';
// storage, RESUME_ID는 컴포넌트 내부에서 접근 가능하다고 가정

const JOB_CATEGORIES = jobjson;

async function fetchOcrData(file) {
  const OCR_API_URL = process.env.NEXT_PUBLIC_RESUME_OCR_API_URL;
  if (!OCR_API_URL) {
    throw new Error("Resume OCR API URL이 설정되지 않았습니다. NEXT_PUBLIC_RESUME_OCR_API_URL 환경 변수를 확인해주세요.");
  }

  const formData = new FormData();
  formData.append('image', file); // 'file' → 'image'로 변경
  formData.append('enhance', 'true'); // 개선 기능 활성화

  const response = await fetch(OCR_API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR API 호출 실패: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'OCR 데이터 추출 실패');
  }

  return result.data;
}

const ResumeBuilder = () => {
  const router = useRouter();
  const currentUser = useSelector((state) => state.user.currentUser);
  
  // View states
  const [view, setView] = useState('list'); // 'list' or 'form'
  const [resumeList, setResumeList] = useState([]);
  const [editingResumeId, setEditingResumeId] = useState(null);
  
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [photoAlbum, setPhotoAlbum] = useState([]);
  
  const fileInputRef = useRef(null);
  const fileInputRef2 = useRef(null);
  const [isClient, setIsClient] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  
  // Modal states
  const [showJobModal, setShowJobModal] = useState(false);
  const [showWorkLocationModal, setShowWorkLocationModal] = useState(false);
  const [selectedParentRegion, setSelectedParentRegion] = useState('서울');

  const [showLanguageModal , setShowLanguageModal ] = useState(false);
  
  // Job selection states
  const [selectedCategory, setSelectedCategory] = useState('기획·전략');
  const [jobSearchTerm, setJobSearchTerm] = useState('');
  
  const USER_ID = currentUser?.uid;
  const [RESUME_ID, setRESUME_ID] = useState('');

  const [portfolioList, setPortfolioList] = useState([]);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [tempPortfolio, setTempPortfolio] = useState({ 
      type: 'file', // 'file' 또는 'link'
      name: '',     // 파일명 또는 링크 제목
      file: null,   // 실제 파일 객체
      url: '',      // 파일 다운로드 URL 또는 링크 URL
      isPublic: true // 이력서에 노출 여부
  });
  const fileInputRef3 = useRef(null);
  
  useEffect(() => {
    setIsClient(true);
    if (USER_ID && !editingResumeId) {
      setRESUME_ID(`${USER_ID}_${Date.now()}`);
    }
  }, [USER_ID, editingResumeId]);
  
  const [formData, setFormData] = useState({
    // 기본 정보
    name: '',
    birthDate: '',
    phone: '',
    email: '',
    address: '',
    
    // 학력
    educations: [{
      school: '',
      degree: '고등학교', // 기본값으로 고등학교 추가
      major: '',
      entryYear: '',
      graduationYear: '',
      status: '졸업'
    }],
    
    // 자기소개서
    selfIntroduction: '',
    selfIntroductionEnhanced: '',
    
    // 경력사항
    careers: [],
    
    // 희망근무 조건
    workPreferences: {
      workType: ['아르바이트'],
      workPeriod: '3개월 이하',
      workDays: ['평일'],
      workLocation: {
        regions: [],
        address: '',
        canWorkRemote: false
      },
      selectedJobs: [],
      selectedSpecialties: []
    },
    
    // 추가 섹션들
    languages: [],
    certificates: [],
    computerSkills: [],
    specialties: [],
    portfolios: [],
    photoAlbum: [],
    
    // 취업우대사항
    employmentPreferences: {
      disability: '비장애',
      military: '군필',
      veteran: '비대상',
      subsidy: '비대상'
    },

    // 이력서 설정
    resumeSettings: {
      isPublic: true,
      publicPeriod: 90,
      allowContact: true,
      contactMethod: 'email',
      availableTime: {
        startTime: '09:00',
        endTime: '18:00'
      }
    }
  });

  const [isGenerating, setIsGenerating] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const currentCategory = JOB_CATEGORIES[selectedCategory] || {};

  // OCR 관련 상태 및 Ref
  const [isOcrProcessing, setIsOcrProcessing] = useState(false); // OCR 처리 중 상태
  const ocrFileInputRef = useRef(null); // OCR 파일 인풋 Ref

  // searchKeywords와 regionCode 계산 함수
  const getSearchKeywords = () => {
    const { selectedJobs, selectedSpecialties } = formData.workPreferences;
    return [...selectedJobs, ...selectedSpecialties];
  };

const getRegionCode = () => {
    const { regions } = formData.workPreferences.workLocation;
    
    // 지역이 선택되지 않았거나 지역무관인 경우
  if (!regions.length || regions.includes('지역무관')) {
      return ['00000']; // 지역무관 코드를 배열로 반환
    }
    
    // 선택된 모든 지역의 코드를 찾아서 배열로 반환
    const regionCodes = [];
    
    for (const region of regions) {
      // 정확한 매칭을 위해 지역명 처리
      let matchedCode = null;
      
      // 1. 정확한 지역명으로 먼저 찾기
      if (REGION_CODES[region]) {
        matchedCode = REGION_CODES[region];
      } else {
        // 2. "서울 강남구" 형태로 찾기 (서울의 경우)
        const seoulRegion = `서울 ${region}`;
        if (REGION_CODES[seoulRegion]) {
          matchedCode = REGION_CODES[seoulRegion];
        } else {
          // 3. 다른 광역시도와 조합해서 찾기
          const prefixes = ['부산', '대구', '인천', '광주', '대전', '울산', '경기', '충북', '충남', '전북', '전남', '경북', '경남', '강원', '제주'];
          
          for (const prefix of prefixes) {
            const fullRegionName = `${prefix} ${region}`;
            if (REGION_CODES[fullRegionName]) {
              matchedCode = REGION_CODES[fullRegionName];
              break;
            }
          }
        }
      }
      
      if (matchedCode) {
        regionCodes.push(matchedCode);
      }
    }
    
    // 매칭되는 지역 코드가 없으면 지역무관으로 처리
  return regionCodes.length > 0 ? regionCodes : ['00000'];
  };

// 추가 데이터 평탄화 도구들
const parseDateSafe = (dateStr) => {
  if (!dateStr) return null;
  
  // YYYYMMDD 형식 처리
  if (dateStr.match(/^\d{8}$/)) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // 월은 0부터 시작
    const day = parseInt(dateStr.substring(6, 8));
    const dt = new Date(year, month, day);
    // 유효한 날짜인지 확인 (예: 20231301 같은 잘못된 날짜 방지)
    if (dt.getFullYear() === year && dt.getMonth() === month && dt.getDate() === day) {
      return dt;
    }
  }

  // 기존 Date 파싱 시도 (YYYY/MM/DD, YYYY-MM-DD 등)
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt;
};

const computeTotalCareerMonths = () => {
  const now = new Date();
  let totalMonths = 0;
  const careers = formData.careers || [];
  for (const career of careers) {
    const start = parseDateSafe(career.startDate);
    const end = career.isCurrent ? now : parseDateSafe(career.endDate) || now;
    if (start && end) {
      const months = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      totalMonths += months;
    }
  }
  return totalMonths;
};

const rankEducationStatus = (status) => {
  const map = { '수료': 0, '중퇴': 1, '재학중': 2, '휴학중': 3, '졸업': 4 };
  return map[status] ?? 0;
};

const determineEducationLevelCodeFromEdu = (ed) => {
  const schoolName = (ed?.school || '').toLowerCase();
  const majorName = (ed?.major || '').toLowerCase();
  const degree = (ed?.degree || '').toLowerCase(); // 새로운 degree 필드 추가
  const subDegree = (ed?.subDegree || '').toLowerCase(); // 새로운 subDegree 필드 추가

  // 박사
  if (subDegree.includes('박사')) return 6;
  // 석사
  if (subDegree.includes('석사')) return 5;
  // 대학 (4년)
  if (degree.includes('대학(4년)')) return 4;
  // 대학 (2,3년) - 전문대학, 전문대 등 포함
  if (degree.includes('대학(2,3년)')) return 3;
  // 고등학교
  if (degree.includes('고등학교')) return 2;
  // 중학교
  if (degree.includes('중학교')) return 1;
  // 초등학교
  if (degree.includes('초등학교')) return 0;
  return 0;
};

const getMainEducation = () => {
  const educations = formData.educations || [];
  if (educations.length === 0) return null;

  let bestEdu = educations[0];
  let bestRank = rankEducationStatus(bestEdu.status);
  let bestLevelCode = determineEducationLevelCodeFromEdu(bestEdu);

  educations.forEach(edu => {
    const currentRank = rankEducationStatus(edu.status);
    const currentLevelCode = determineEducationLevelCodeFromEdu(edu);

    // 학력 레벨이 더 높으면 선택
    if (currentLevelCode > bestLevelCode) {
      bestEdu = edu;
      bestRank = currentRank;
      bestLevelCode = currentLevelCode;
    } else if (currentLevelCode === bestLevelCode) {
      // 학력 레벨이 같으면 상태 랭크가 더 높은 것 선택
      if (currentRank > bestRank) {
        bestEdu = edu;
        bestRank = currentRank;
      }
    }
  });

  return bestEdu;
};

const getEducationLevelCode = () => {
  const mainEdu = getMainEducation();
  return mainEdu ? determineEducationLevelCodeFromEdu(mainEdu) : 0;
};

const getEducationStatus = () => {
  const mainEdu = getMainEducation();
  let status = mainEdu?.status || '';
  if (status === '졸업예정') {
    status = '휴학중'; // 졸업예정은 휴학중으로 통일
  }
  return status;
};

const getBirthYear = () => {
  const date = parseDateSafe(formData.birthDate);
  if (!date) return null;
  const year = date.getFullYear();
  return isNaN(year) ? null : year;
};

  // 로그인 체크
  useEffect(() => {
    if (!USER_ID) {
      alert('⚠️ 로그인이 필요합니다.');
      router.push('/login');
      return;
    }
  }, [USER_ID, router]);

  // Load resume list on mount
  useEffect(() => {
    if (USER_ID) {
      loadResumeList();
    }
  }, [USER_ID]);

  // 이력서 목록 불러오기
  const loadResumeList = async () => {
    if (!USER_ID) return;
    
    setIsLoading(true);
    try {
      const resumesRef = collection(db, 'resumes');
      const q = query(resumesRef, where('userId', '==', USER_ID));
      const snapshot = await getDocs(q);
      
      const resumes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setResumeList(resumes.sort((a, b) => new Date(b.updatedAt?.toDate?.() || b.updatedAt) - new Date(a.updatedAt?.toDate?.() || a.updatedAt)));
    } catch (error) {
      console.error('이력서 목록 로딩 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOcrFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (10MB = 10 * 1024 * 1024 bytes)
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하만 업로드할 수 있습니다.');
      e.target.value = ''; // 파일 input 초기화
      return;
    }

    setIsOcrProcessing(true);
    try {
      const ocrData = await fetchOcrData(file);
      
      // 💡 깊은 병합(Deep Merge)으로 상태 업데이트
      setFormData(prev => {
        const newFormData = { ...prev };

        for (const key in ocrData) {
          if (Object.prototype.hasOwnProperty.call(ocrData, key)) {
            // 객체이고 null이 아니며 배열이 아닌 경우 깊은 병합
            if (typeof ocrData[key] === 'object' && ocrData[key] !== null && !Array.isArray(ocrData[key]) && prev[key]) {
              newFormData[key] = { ...prev[key], ...ocrData[key] };
            } else {
              // 그 외의 경우는 덮어쓰기
              newFormData[key] = ocrData[key];
            }
          }
        }
        return newFormData;
      });

      alert('✅ 이력서 파일에서 정보를 성공적으로 추출하여 적용했습니다!');
    } catch (error) {
      console.error('OCR 파일 업로드 및 처리 오류:', error);
      alert(`❌ 이력서 파일 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsOcrProcessing(false);
      e.target.value = ''; // 파일 input 초기화
    }
  };

  // Firebase 저장 함수
  const saveToFirebase = async (data) => {
    const docRef = doc(db, 'resumes', RESUME_ID);
    
    const regionCodesArray = getRegionCode();
    const totalCareerMonths = computeTotalCareerMonths();
    const educationStatusValue = getEducationStatus();
    const educationLevelValue = getEducationLevelCode();
    const birthYearValue = getBirthYear();
    const certificateNames = (data.certificates || []).map(cert => cert.name);
    const languageNames = (data.languages || []).map(lang => lang.language);
    const mainEducation = getMainEducation();

    const regionCodeFields = {};
    regionCodesArray.forEach((code, idx) => {
      regionCodeFields[`regionCode_${idx + 1}`] = code;
    });

    const baseData = {
      ...data,
      userId: USER_ID,
      resumeId: RESUME_ID,
      searchKeywords: getSearchKeywords(),
      regionCode: regionCodesArray,
      regionCodes: regionCodesArray,
      totalCareerMonths: totalCareerMonths,
      minCareerYears: Math.floor(totalCareerMonths / 12),
      educationStatus: educationStatusValue,
      educationLevelCode: educationLevelValue,
      birthYear: birthYearValue, // age 대신 birthYear 사용
      certificateNames: certificateNames,
      languageNames: languageNames,
      // educations 배열은 최고 학위 하나만 저장
      educations: data.educations, // educations 배열 전체를 저장하도록 변경
      disability: data.employmentPreferences.disability, // disability 필드 추가
      regionCodesCount: regionCodesArray.length,
      ...regionCodeFields,
      resumeSettings: {
        ...data.resumeSettings,
        publicEndDate: (() => {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + (data.resumeSettings.publicPeriod || 90));
            return endDate;
        })()
      },
      updatedAt: serverTimestamp()
    };

    if (hasExistingData) {
      const updateData = baseData;
      try {
        await updateDoc(docRef, updateData);
      } catch (error) {
        const cleanData = Object.fromEntries(
          Object.entries(updateData).filter(([_, v]) => v !== undefined)
        );
        await updateDoc(docRef, cleanData);
      }
    } else {
      const setData = {
        ...baseData,
        createdAt: serverTimestamp()
      };

      await setDoc(docRef, setData);
      setHasExistingData(true);
    }
  };

  // 수동 저장 함수
  const handleManualSave = async () => {
    if (!USER_ID) {
      alert('⚠️ 로그인이 필요합니다.');
      return;
    }

    if (!formData.name || !formData.email) {
      alert('⚠️ 이름과 이메일은 필수 항목입니다.');
      return;
    }

    setIsSaving(true);

    try {
      let finalProfileImageUrl = profileImageUrl;

      // 1. 새로운 프로필 사진 파일(profileImage)이 있는지 확인합니다.
      if (profileImage) {
        // 2. 파일이 있다면 Firebase Storage에 업로드합니다.
        const storageRef = strRef(storage, `resumes/${RESUME_ID}/profile/profileImage_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, profileImage);
        // 3. 업로드된 파일의 다운로드 URL을 가져옵니다.
        finalProfileImageUrl = await getDownloadURL(snapshot.ref);
        
        // 4. 업로드가 완료되었으므로, 임시 파일 상태를 초기화합니다.
        setProfileImage(null); 
        setProfileImageUrl(finalProfileImageUrl); // UI에도 반영
      }

      const resumeData = {
        ...formData,
        profileImageUrl: finalProfileImageUrl || null,
        photoAlbum: photoAlbum,
      };

      await saveToFirebase(resumeData);
      setLastSaved(new Date());
      alert('✅ 이력서가 저장되었습니다!');
      loadResumeList(); // 목록 새로고침
    } catch (error) {
      console.error('Manual save error:', error);
      alert(`❌ 저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // AI 텍스트 개선 함수
  const enhanceTextWithGemini = async (field, originalText) => {
    if (!originalText.trim()) {
      alert('먼저 내용을 입력해주세요.');
      return;
    }
    
    setIsGenerating(prev => ({ ...prev, [field]: true }));
    
    try {
      const enhancedText = `[AI 개선됨] ${originalText}\n\n• 전문적이고 구체적인 표현으로 개선\n• 핵심 역량과 성과를 강조\n• 읽기 쉽고 임팩트 있는 구성으로 재작성`;
      
      setFormData(prev => ({
        ...prev,
        [`${field}Enhanced`]: enhancedText
      }));
      
      alert('✨ AI가 내용을 개선했습니다!');
    } catch (error) {
      console.error('Error:', error);
      alert('AI 개선 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(prev => ({ ...prev, [field]: false }));
    }
  };

  // AI 이미지 개선 함수
  const enhanceImageWithGemini = async () => {
    if (!profileImage) {
      alert('먼저 사진을 업로드해주세요.');
      return;
    }
    
    setIsGenerating(prev => ({ ...prev, image: true }));
    
    try {
      const storageRef = strRef(storage, `resumes/${RESUME_ID}/profile/profileImage`);
      const snapshot = await uploadBytes(storageRef, profileImage);
      const imageUrl = await getDownloadURL(snapshot.ref);
      setProfileImageUrl(imageUrl);
      alert('✨ 사진이 최적화되고 저장되었습니다!');
    } catch (error) {
      console.error('Image enhancement error:', error);
      alert(`❌ 사진 변환 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsGenerating(prev => ({ ...prev, image: false }));
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB 이하여야 합니다.');
        return;
      }
      
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImageUrl(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };


  const uploadImageToFirebase = async (file) => {
    // 💡 1. 파일 경로 설정 시, 업로드할 'file' 객체의 name을 사용해야 합니다.
    // 💡 2. 고유성을 위해 파일 이름에 타임스탬프를 추가하는 것이 좋습니다.
    const uniqueFileName = `${Date.now()}_${file.name}`;
    
    // RESUME_ID는 외부에서 정의된 상수라고 가정
    const storageRef = strRef(storage, `resumes/${RESUME_ID}/photoAlbum/${uniqueFileName}`); 
    
    // Firebase Storage에 파일 업로드
    await uploadBytes(storageRef, file);
    
    // 💡 3. 'downloadURL'을 반환하여 외부에서 접근 가능한 URL을 사용합니다.
    const downloadURL = await getDownloadURL(storageRef);
    
    return downloadURL; // Promise를 사용하지 않고 바로 downloadURL 반환
};


  const handleImageUpload2 = async (e) => {
    if (photoAlbum.length >= 5) {
        alert('사진은 최대 5개까지 등록할 수 있습니다.');
        return;
    }

    const file = e.target.files[0];
    if (file) {
        if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
            alert('JPG, GIF, PNG 파일만 업로드할 수 있습니다.');
            return;
        }
        if (file.size > 6 * 1024 * 1024) { // 6MB 제한
            alert('파일 크기는 6MB 이하여야 합니다.');
            return;
        }

        try {
            // 🔥 Firebase 업로드 함수 호출 및 URL 받기
            const imageUrl = await uploadImageToFirebase(file);
            
            // 새 사진 객체 생성
            const newPhoto = {
                id: Date.now(),
                url: imageUrl,
                // 첫 번째 사진이라면 자동으로 공개 설정
                isPublic: photoAlbum.length === 0, 
            };
            
            setPhotoAlbum(prev => [...prev, newPhoto]);
            e.target.value = ''; // 같은 파일 재선택을 위해 input 초기화
        } catch (error) {
            console.error("Image upload failed:", error);
            alert('이미지 업로드에 실패했습니다.');
        }
    }
};


const deleteFileFromFirebase = async (imageUrl) => {
    try {
        // [주의] URL에서 Storage 경로를 추출하는 로직이 필요합니다.
        // Firebase Storage URL에서 path를 추출하는 표준 로직을 사용하거나,
        // 업로드 시 경로를 별도의 필드에 저장해야 합니다.
        
        // 가장 간단한 방법: URL을 사용하여 Storage Ref를 생성합니다.
        // 이는 Firebase SDK의 getStorage().refFromURL(imageUrl) 방식과 유사합니다.
        // 웹 환경에서는 gs:// 형식의 레퍼런스를 직접 생성해야 할 수도 있습니다.
        
        // 여기서는 URL에서 파일 경로를 추출하는 (간단화된) 로직을 사용합니다.
        // 실제로는 업로드 시 file path를 photoAlbum 객체에 함께 저장하는 것이 가장 안전합니다.
        
        // 💡 안전한 방법: photoAlbum 객체에 path를 저장했다고 가정하고,
        // photoAlbum.find(p => p.url === imageUrl)?.path; 를 사용하거나,
        // 여기서는 downloadURL을 사용하여 ref를 직접 생성합니다. (더 안정적)
        
        const fileRef = strRef(storage, imageUrl);
        await deleteObject(fileRef);
        
    } catch (error) {
        // 파일이 존재하지 않는 경우 (404)는 무시하고, 다른 오류만 보고합니다.
        if (error.code !== 'storage/object-not-found') {
            console.error('Firebase Storage 파일 삭제 실패:', error);
            // 사용자에게 경고를 표시할지 결정합니다. (Storage 삭제는 실패해도 UI는 진행하는 경우가 많음)
        }
    }
};


// 2. 사진 삭제 처리
const removePhoto = async (id) => { // 💡 async로 변경
    setPhotoAlbum(prev => {
        const deletedPhoto = prev.find(photo => photo.id === id);
        
        // 1. Firebase Storage 삭제 요청 (비동기)
        if (deletedPhoto && deletedPhoto.url) {
            // 비동기 함수는 setPhotoAlbum 내부에서 직접 await 할 수 없으므로, 따로 호출합니다.
            deleteFileFromFirebase(deletedPhoto.url); 
        }

        // 2. 상태(UI) 업데이트 로직
        const newAlbum = prev.filter(photo => photo.id !== id);
        
        // 삭제된 사진이 공개 설정된 사진이었고, 앨범에 다른 사진이 남아있다면
        if (deletedPhoto?.isPublic && newAlbum.length > 0) {
            // 새 배열을 복사하여 첫 번째 요소를 공개로 설정 (불변성 유지)
            return newAlbum.map((photo, index) => ({
                ...photo,
                isPublic: index === 0 ? true : photo.isPublic 
            }));
        }
        
        return newAlbum;
    });
};

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleArrayItem = (array, item) => {
    return array.includes(item) ? array.filter(i => i !== item) : [...array, item];
  };

  // 경력사항 관련 함수들
  const [tempCareer, setTempCareer] = useState({});

  const addCareer = () => {
    if (!tempCareer.company || !tempCareer.position) {
      alert('회사명과 직책을 입력해주세요.');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      careers: [...prev.careers, { ...tempCareer, id: Date.now() }]
    }));
    
    setTempCareer({});
  };

  const removeCareer = (id) => {
    setFormData(prev => ({
      ...prev,
      careers: prev.careers.filter(career => career.id !== id)
    }));
  };

  // 외국어 능력 관련 함수들
  const [tempLanguage, setTempLanguage] = useState({
    language: '',
    level: '초급',
    testName: '',
    score: '',
    date: ''
  });

  // 공인시험 목록
  const officialTests = [
    'TOEIC', 'TOEIC(Speaking)', 'TOEIC(Writing)', 'TOEIC(Speaking&Writing)',
    'TOEIC(Bridge)', 'TOEFL(PBT)', 'TOEFL(IBT)', 'TOEFL(CBT)', 'TEPS',
    'IELTS', 'G-TELP(GST)', 'G-TELP(GLT)', 'G-ETAT', 'OPIC', 'GMAT',
    'GRE', 'PELT', 'SEPT', 'SLEP', '기타'
  ];

  const addLanguage = () => {
    if (!tempLanguage.language) {
      alert('언어를 입력해주세요.');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      languages: [...prev.languages, { ...tempLanguage, id: Date.now() }]
    }));
    
    setTempLanguage({
      language: '',
      level: '초급',
      testName: '',
      score: '',
      date: ''
    });
    setShowLanguageModal(false);
  };

  const removeLanguage = (id) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.filter(lang => lang.id !== id)
    }));
  };

  // 컴퓨터 활용능력 관련 함수들
  const computerPrograms = {
    '워드': ['상', '중', '하'],
    '엑셀': ['상', '중', '하'],
    '파워포인트': ['상', '중', '하'],
    '인터넷': ['상', '중', '하']
  };

  // 자격증 관련 함수들
  const [tempCertificate, setTempCertificate] = useState({
    name: '',
    issuer: '',
    date: '',
    score: ''
  });

  const addCertificate = () => {
    if (!tempCertificate.name) {
      alert('자격증명을 입력해주세요.');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      certificates: [...prev.certificates, { ...tempCertificate, id: Date.now() }]
    }));
    
    setTempCertificate({
      name: '',
      issuer: '',
      date: '',
      score: ''
    });
  };

  const removeCertificate = (id) => {
    setFormData(prev => ({
      ...prev,
      certificates: prev.certificates.filter(cert => cert.id !== id)
    }));
  };

  // 특기사항 관련 함수들
  const [tempSpecialty, setTempSpecialty] = useState({
    title: '',
    content: ''
  });

  // 포트폴리오 관련 함수들
  const addPortfolio = async () => {
    if (tempPortfolio.type === 'file' && !tempPortfolio.file) {
      alert('파일을 선택해주세요.');
      return;
    }
    if (tempPortfolio.type === 'link' && !tempPortfolio.url) {
      alert('URL을 입력해주세요.');
      return;
    }
    if (!tempPortfolio.name) {
      alert('제목을 입력해주세요.');
      return;
    }

    try {
      let finalUrl = tempPortfolio.url;
      
      if (tempPortfolio.type === 'file') {
        // Firebase Storage에 파일 업로드
        const uniqueFileName = `${Date.now()}_${tempPortfolio.file.name}`;
        const storageRef = strRef(storage, `resumes/${RESUME_ID}/portfolio/${uniqueFileName}`);
        const snapshot = await uploadBytes(storageRef, tempPortfolio.file);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      const newPortfolio = {
        id: Date.now(),
        type: tempPortfolio.type,
        name: tempPortfolio.name,
        url: finalUrl,
        isPublic: tempPortfolio.isPublic,
        fileName: tempPortfolio.file?.name || null,
        storagePath: tempPortfolio.type === 'file' ? `resumes/${RESUME_ID}/portfolio/${tempPortfolio.file?.name}` : null
      };

      setFormData(prev => ({
        ...prev,
        portfolios: [...prev.portfolios, newPortfolio]
      }));

      setTempPortfolio({
        type: 'file',
        name: '',
        file: null,
        url: '',
        isPublic: true
      });
      setShowPortfolioModal(false);
      alert('포트폴리오가 추가되었습니다!');
    } catch (error) {
      console.error('Portfolio upload error:', error);
      alert('포트폴리오 업로드 중 오류가 발생했습니다.');
    }
  };

  const removePortfolio = async (id) => {
    const portfolio = formData.portfolios.find(p => p.id === id);
    
    if (portfolio && portfolio.type === 'file' && portfolio.storagePath) {
      try {
        const fileRef = strRef(storage, portfolio.storagePath);
        await deleteObject(fileRef);
      } catch (error) {
        console.error('Portfolio file deletion error:', error);
      }
    }

    setFormData(prev => ({
      ...prev,
      portfolios: prev.portfolios.filter(p => p.id !== id)
    }));
  };

  const addSpecialty = () => {
    if (!tempSpecialty.title) {
      alert('특기사항 제목을 입력해주세요.');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      specialties: [...prev.specialties, { ...tempSpecialty, id: Date.now() }]
    }));
    
    setTempSpecialty({
      title: '',
      content: ''
    });
  };

  const removeSpecialty = (id) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.filter(spec => spec.id !== id)
    }));
  };

  // 학력 관련 함수들
  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      educations: [...prev.educations, {
        school: '',
        degree: '고등학교', // 기본값으로 고등학교 추가
        major: '',
        entryYear: '',
        graduationYear: '',
        status: '졸업'
      }]
    }));
  };

  const removeEducation = (index) => {
    setFormData(prev => ({
      ...prev,
      educations: prev.educations.filter((_, i) => i !== index)
    }));
  };

  const updateEducation = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      educations: prev.educations.map((edu, i) => 
        i === index ? { ...edu, [field]: value } : edu
      )
    }));
  };

  // 이미지 최적화 함수
  const optimizeImageForPDF = async (imgElement) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 최대 해상도 제한 (300 DPI 기준)
      const maxWidth = 600;
      const maxHeight = 800;
      
      let { width, height } = imgElement;
      
      // 비율 유지하면서 크기 조정
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(imgElement, 0, 0, width, height);
      
      // 압축된 이미지 데이터 반환 (품질 0.6)
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    });
  };

  // PDF 다운로드 함수 (최적화됨 - 10MB 이하 보장)
  const downloadPDF = async () => {
    setIsDownloadingPdf(true);
    const resumePreviewElement = document.getElementById('resume-preview-for-pdf');
    if (!resumePreviewElement) {
      alert('PDF 생성에 필요한 템플릿을 찾을 수 없습니다.');
      setIsDownloadingPdf(false);
      return;
    }

    try {
      // 1. 이미지 최적화 전처리
      const images = resumePreviewElement.querySelectorAll('img');
      const optimizedImages = new Map();
      
      for (const img of images) {
        if (img.src && !img.src.startsWith('data:')) {
          try {
            const optimizedSrc = await optimizeImageForPDF(img);
            optimizedImages.set(img.src, optimizedSrc);
          } catch (error) {
            console.warn('이미지 최적화 실패:', img.src, error);
          }
        }
      }

      // 2. PDF 생성 (최적화된 설정)
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
        precision: 2
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // 여백 줄임
      let yPosition = margin;

      const sections = resumePreviewElement.querySelectorAll('.pdf-section');
      let totalSections = sections.length;
      let processedSections = 0;

      for (const section of Array.from(sections)) {
        // 3. 섹션별 최적화된 캔버스 생성
        const canvas = await html2canvas(section, {
          scale: 1.2, // 해상도 낮춤
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            // 최적화된 이미지로 교체
            const clonedImages = clonedDoc.querySelectorAll('img');
            clonedImages.forEach(img => {
              if (optimizedImages.has(img.src)) {
                img.src = optimizedImages.get(img.src);
              }
            });
          }
        });

        // 4. 압축된 이미지 데이터 생성
        const imgData = canvas.toDataURL('image/jpeg', 0.7);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = imgWidth / imgHeight;
        const availableWidth = pdfWidth - (margin * 2);
        const imgHeightInPdf = availableWidth / ratio;

        // 5. 페이지 분할 처리 (잘림 방지)
        const availableHeight = pdfHeight - margin;
        
        if (yPosition + imgHeightInPdf > availableHeight) {
          // 새 페이지가 필요한 경우
          pdf.addPage();
          yPosition = margin;
          
          // 섹션이 한 페이지보다 큰 경우 분할 처리
          if (imgHeightInPdf > pdfHeight - (margin * 2)) {
            const pageHeight = pdfHeight - (margin * 2);
            let remainingHeight = imgHeightInPdf;
            let currentY = 0;
            
            while (remainingHeight > 0) {
              const currentHeight = Math.min(remainingHeight, pageHeight);
              const sourceY = (currentY / imgHeightInPdf) * imgHeight;
              const sourceHeight = (currentHeight / imgHeightInPdf) * imgHeight;
              
              // 이미지 분할을 위한 임시 캔버스
              const tempCanvas = document.createElement('canvas');
              const tempCtx = tempCanvas.getContext('2d');
              tempCanvas.width = imgWidth;
              tempCanvas.height = sourceHeight;
              
              // 원본 이미지에서 해당 부분만 추출
              const img = new Image();
              img.src = imgData;
              
              // 동기적 처리를 위한 Promise
              await new Promise((resolve) => {
                img.onload = () => {
                  tempCtx.drawImage(img, 0, -sourceY, imgWidth, imgHeight);
                  const splitImgData = tempCanvas.toDataURL('image/jpeg', 0.7);
                  pdf.addImage(splitImgData, 'JPEG', margin, yPosition, availableWidth, currentHeight);
                  
                  // 메모리 정리
                  tempCanvas.width = 0;
                  tempCanvas.height = 0;
                  resolve();
                };
                
                // 이미 로드된 경우 즉시 실행
                if (img.complete) {
                  img.onload();
                }
              });
              
              remainingHeight -= currentHeight;
              currentY += currentHeight;
              
              if (remainingHeight > 0) {
                pdf.addPage();
                yPosition = margin;
              } else {
                yPosition += currentHeight + 3;
              }
            }
          } else {
            // 일반적인 새 페이지 추가
            pdf.addImage(imgData, 'JPEG', margin, yPosition, availableWidth, imgHeightInPdf);
            yPosition += imgHeightInPdf + 3;
          }
        } else {
          // 현재 페이지에 추가
          pdf.addImage(imgData, 'JPEG', margin, yPosition, availableWidth, imgHeightInPdf);
          yPosition += imgHeightInPdf + 3;
        }

        // 메모리 정리
        canvas.width = 0;
        canvas.height = 0;
      }

      // 6. PDF 크기 체크 및 추가 최적화
      let pdfBlob = pdf.output('blob');
      let pdfSizeMB = pdfBlob.size / (1024 * 1024);
      
      // 10MB 초과 시 추가 압축
      if (pdfSizeMB > 10) {
        alert('PDF 크기가 큽니다. 압축 중...');
        
        // 더 강한 압축으로 재생성
        const compressedPdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          compress: true,
          precision: 1
        });

        yPosition = margin;
        processedSections = 0;
        for (const section of Array.from(sections)) {
          const canvas = await html2canvas(section, {
            scale: 1.0, // 더 낮은 해상도
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const clonedImages = clonedDoc.querySelectorAll('img');
              clonedImages.forEach(img => {
                if (optimizedImages.has(img.src)) {
                  img.src = optimizedImages.get(img.src);
                }
              });
            }
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.5); // 더 낮은 품질
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = imgWidth / imgHeight;
          const availableWidth = pdfWidth - (margin * 2);
          const imgHeightInPdf = availableWidth / ratio;

          if (yPosition + imgHeightInPdf > pdfHeight - margin) {
            compressedPdf.addPage();
            yPosition = margin;
          }

          compressedPdf.addImage(imgData, 'JPEG', margin, yPosition, availableWidth, imgHeightInPdf);
          yPosition += imgHeightInPdf + 2;
          
          // 메모리 정리
          canvas.width = 0;
          canvas.height = 0;
        }
        
        pdfBlob = compressedPdf.output('blob');
        pdfSizeMB = pdfBlob.size / (1024 * 1024);
        
        if (pdfSizeMB <= 10) {
          compressedPdf.save(`${formData.name || '이력서'}_${new Date().toISOString().split('T')[0]}.pdf`);
          alert(`✅ PDF가 성공적으로 생성되었습니다! (크기: ${pdfSizeMB.toFixed(2)}MB)`);
        } else {
          alert(`⚠️ PDF 크기가 여전히 ${pdfSizeMB.toFixed(2)}MB로 큽니다. 이미지를 더 줄여주세요.`);
        }
      } else {
        pdf.save(`${formData.name || '이력서'}_${new Date().toISOString().split('T')[0]}.pdf`);
        alert(`✅ PDF가 성공적으로 생성되었습니다! (크기: ${pdfSizeMB.toFixed(2)}MB)`);
      }
      
    } catch (error) {
      console.error("PDF 생성 오류:", error);
      alert("PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsDownloadingPdf(false);
      
      // 메모리 정리
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
    }
  };


const deleteAssociatedImages = async (imageUrls) => {
    // URL이 Base64 데이터인지 확인
    const isBase64 = (url) => url.startsWith('data:');

    // Firebase Download URL에서 Storage 파일 경로를 추출하는 함수
    const extractStoragePath = (url) => {
        if (isBase64(url)) {
            return null; // Base64는 Storage 경로가 아님
        }
        try {
            // URL 디코딩
            const decoded = decodeURIComponent(url);
            
            // "/o/"와 "?alt=" 또는 "%3Falt=" 사이의 경로를 정규식으로 추출
            const match = decoded.match(/\/o\/(.+?)(?:\?alt=|%3Falt=)/);
            
            return match ? match[1] : null;
        } catch (e) {
            return null;
        }
    };

    const deletePromises = imageUrls.map((url) => {
        const path = extractStoragePath(url);
        
        if (!path) {
            // Base64 또는 유효하지 않은 URL은 건너뜁니다.
            console.warn(`⚠️ 유효하지 않거나 Base64 URL: ${url.substring(0, 50)}...`);
            return Promise.resolve();
        }
        
        // strRef는 Firebase Storage의 ref 함수라고 가정
        const fileRef = strRef(storage, path); 
        
        return deleteObject(fileRef)
            .catch((err) => {
                // 파일이 이미 삭제되었거나, 존재하지 않아(object-not-found) 삭제에 실패한 경우
                if (err.code !== 'storage/object-not-found') {
                    console.error(`❌ Storage에서 이미지 삭제 실패 (${path}):`, err);
                }
            });
    });

    // 모든 삭제 작업이 완료될 때까지 기다림
    await Promise.all(deletePromises);
};


// =================================================================
// 2. 이력서 문서와 관련 이미지들을 삭제하는 메인 함수
// =================================================================
const deleteResume = async (resumeId) => {
    if (!resumeId) {
        console.error("삭제할 이력서 ID가 없습니다.");
        return;
    }
    
    if (!confirm('정말 이 이력서를 삭제하시겠습니까? 삭제된 이력서는 복구할 수 없습니다.')) {
        return;
    }

    try {
        const resumeDocRef = doc(db, 'resumes', resumeId);
        
        // 1. Firestore에서 이력서 데이터를 먼저 로드하여 URL 목록 확보
        const docSnap = await getDoc(resumeDocRef);
        
        let imageUrlsToDelete = [];
        
        if (docSnap.exists()) {
            const resumeData = docSnap.data();
            
            // a. 프로필 이미지 URL 추가
            if (resumeData.profileImageUrl) {
                imageUrlsToDelete.push(resumeData.profileImageUrl);
            }
            
            // b. 포토앨범 URL 추가
            if (resumeData.photoAlbum && Array.isArray(resumeData.photoAlbum)) {
                // photoAlbum은 객체 배열이므로 URL 필드만 추출
                imageUrlsToDelete = imageUrlsToDelete.concat(
                    resumeData.photoAlbum.map(photo => photo.url).filter(url => url)
                );
            }
            
            // c. 포트폴리오 파일 URL 추가
            if (resumeData.portfolios && Array.isArray(resumeData.portfolios)) {
              imageUrlsToDelete = imageUrlsToDelete.concat(
                  resumeData.portfolios // 🚨 배열 이름 변경
                      .filter(p => p.type === 'file' && p.url) 
                      .map(p => p.url)
              );
            }

            // 2. Storage 파일 삭제 (삭제가 실패해도 문서 삭제는 계속 시도하도록 별도 try/catch)
            if (imageUrlsToDelete.length > 0) {
                try {
                    await deleteAssociatedImages(imageUrlsToDelete); 
                } catch(storageError) {
                    console.warn("Storage 파일 삭제 중 오류 발생. Firestore 삭제는 계속합니다.", storageError);
                }
            }
        }
        
        // 3. Firestore에서 이력서 문서 삭제
        await deleteDoc(resumeDocRef);

        // 4. 이력서 목록 새로고침
        await loadResumeList();
        alert('✅ 이력서가 삭제되었습니다.');
        
    } catch (error) {
        // 🚨 이력서 문서 삭제 (deleteDoc) 시 권한 부족(Permission Denied) 오류가 발생했을 가능성이 가장 높습니다.
        console.error('Resume deletion error:', error);
        alert('❌ 이력서 삭제 중 오류가 발생했습니다. (권한 문제일 수 있습니다.)');
    }
};

  // 새 이력서 작성 시작
  const startNewResume = async () => {
    setEditingResumeId(null);
    const newResumeId = `${USER_ID}_${Date.now()}`;
    setRESUME_ID(newResumeId);
    setHasExistingData(false);

    // 기본 폼 데이터 구조
    let initialFormData = {
        name: '', birthDate: '', phone: '', email: '', address: '',
        educations: [{ school: '', degree: '고등학교', major: '', entryYear: '', graduationYear: '', status: '졸업' }],
        selfIntroduction: '', selfIntroductionEnhanced: '', careers: [],
        workPreferences: {
            workType: ['아르바이트'], workPeriod: '3개월 이하', workDays: ['평일'],
            workLocation: { regions: [], address: '', canWorkRemote: false },
            selectedJobs: [], selectedSpecialties: []
        },
        languages: [], certificates: [], computerSkills: [], specialties: [],
        portfolios: [], photoAlbum: [],
        employmentPreferences: {
            disability: '비장애', military: '군필', veteran: '비대상', subsidy: '비대상'
        },
        resumeSettings: {
            isPublic: true, publicPeriod: 90, allowContact: true, contactMethod: 'email',
            availableTime: { startTime: '09:00', endTime: '18:00' }
        }
    };

    // Firestore에서 사용자 정보 가져오기
    try {
        const userDocRef = doc(db, 'users', USER_ID);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            initialFormData.name = userData.displayName || '';
            initialFormData.email = userData.email || '';
            initialFormData.phone = userData.phone || '';
            setProfileImageUrl(userData.photoURL || null);
        }
    } catch (error) {
        console.error("사용자 정보 로딩 실패:", error);
    }

    setFormData(initialFormData);
    setProfileImageUrl(null);
    setView('form');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">이력서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 이력서 목록 화면
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-4 md:py-8">
        <div className="max-w-7xl mx-auto px-3 md:px-6">
          {/* 헤더 섹션 */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">이력서 관리</h1>
                  <p className="text-gray-600 text-sm md:text-base">나만의 이력서를 작성하고 관리하세요</p>
                </div>
              </div>
              <button
                onClick={startNewResume}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center gap-3 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                <Plus className="w-5 h-5" />
                ✨ 새 이력서 작성
              </button>
            </div>
          </div>

          {resumeList.length === 0 ? (
            /* 빈 상태 */
            <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">아직 작성된 이력서가 없습니다</h3>
              <p className="text-gray-600 mb-8 text-sm md:text-base max-w-md mx-auto">
                첫 번째 이력서를 작성하여 나만의 프로필을 완성해보세요!
              </p>
              <button
                onClick={startNewResume}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 text-sm md:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-3 mx-auto"
              >
                <Plus className="w-5 h-5" />
                🚀 첫 이력서 작성하기
              </button>
            </div>
          ) : (
            /* 이력서 목록 */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {resumeList.map(resume => (
                <div key={resume.id} className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100 overflow-hidden">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 pr-4">
                        <h3 className="font-bold text-lg md:text-xl text-gray-900 line-clamp-2 mb-2 leading-tight">
                          {resume.name || '이름 없음'}의 이력서
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium">
                            {resume.resumeSettings?.isPublic ? '공개' : '비공개'}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span>{resume.updatedAt?.toDate?.()?.toLocaleDateString() || '날짜 없음'}</span>
                        </div>
                      </div>
                      {resume.profileImageUrl && (
                        <img src={resume.profileImageUrl} alt="프로필" className="w-12 h-12 rounded-lg object-cover" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed">
                      {resume.selfIntroduction || '자기소개가 작성되지 않았습니다.'}
                    </p>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingResumeId(resume.id);
                          setRESUME_ID(resume.id);
                          setFormData(resume);
                          setProfileImageUrl(resume.profileImageUrl);
                          setPhotoAlbum(resume.photoAlbum || []);
                          setHasExistingData(true);
                          setView('form');
                        }}
                        className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        수정
                      </button>
                      <button
                        onClick={() => deleteResume(resume.id)}
                        className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 이력서 작성 폼 화면
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
                {editingResumeId ? '이력서 수정' : '이력서 작성'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                나만의 이력서를 작성해보세요
              </p>
            </div>
          </div>
        </div>

         {/* OCR 이력서 파일 업로드 섹션 추가 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">이력서 파일 업로드</h2>
            </div>
            <p className="text-gray-600 mb-4">
              이력서 이미지 (JPG, PNG, GIF) 또는 PDF 파일을 업로드하여 자동으로 정보를 추출합니다.
            </p>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors duration-200">
              <input
                type="file"
                ref={ocrFileInputRef}
                onChange={handleOcrFileUpload}
                accept=".jpg,.jpeg,.png,.gif,.pdf"
                className="hidden"
                id="ocr-file-upload"
              />
              <label
                htmlFor="ocr-file-upload"
                className="cursor-pointer bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors duration-200"
              >
                {isOcrProcessing ? '이력서 처리 중...' : '이력서 파일 선택'}
              </label>
              {isOcrProcessing && (
                <p className="mt-2 text-blue-600 animate-pulse">파일을 분석 중입니다...</p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                지원 형식: JPG, PNG, GIF, PDF
              </p>
            </div>
          </div>

        {/* 메인 폼 */}
        <div className="space-y-6">
          {/* 기본 정보 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">기본 정보</h2>
            </div>

            <div className="space-y-6">
              {/* 프로필 사진 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프로필 사진
                </label>
                <div className="flex items-start gap-4">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    {profileImageUrl ? (
                      <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <>
                        <Upload className="text-gray-400 mb-2" size={32} />
                        <span className="text-xs text-gray-500 text-center px-2">
                          사진 업로드
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="flex-1">
                    <button
                      onClick={enhanceImageWithGemini}
                      disabled={!profileImage || isGenerating.image}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 mb-2"
                    >
                      <Sparkles size={18} />
                      {isGenerating.image ? 'AI 최적화 중...' : '사진 AI 최적화'}
                    </button>
                    <p className="text-xs text-gray-500">
                      AI가 이력서용으로 사진을 최적화합니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* 기본 정보 입력 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="이름을 입력해주세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">생년월일</label>
                  <input
                    type="text"
                    value={formData.birthDate}
                    onChange={(e) => handleChange('birthDate', e.target.value)}
                    placeholder="YYYY/MM/DD"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="주소를 입력해주세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* 희망근무 조건 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">희망근무 조건 *</h2>
              <div className="ml-auto text-sm text-gray-500 flex items-center gap-1">
                <span>💡</span>
                <span>맞춤 근무 조건이 더 많은 기업에게 노출됩니다</span>
              </div>
            </div>

            <div className="space-y-6">
              {/* 희망근무지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">희망근무지</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="지역을 선택해 주세요. (최대 3개)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    readOnly
                    value={formData.workPreferences.workLocation.regions.join(', ')}
                  />
                  <button
                    onClick={() => setShowWorkLocationModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    선택
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.workPreferences?.workLocation?.canWorkRemote ?? false}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      workPreferences: {
                        ...prev.workPreferences,
                        workLocation: {
                          ...prev.workPreferences.workLocation,
                          canWorkRemote: e.target.checked
                        }
                      }
                    }))}
                    className="text-blue-600"
                  />
                  <span>재택근무</span>
                </label>
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
                              <span className={`${(formData.workPreferences.selectedJobs.length + formData.workPreferences.selectedSpecialties.length) > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                {(formData.workPreferences.selectedJobs.length + formData.workPreferences.selectedSpecialties.length) > 0 
                                  ? `${formData.workPreferences.selectedJobs.length + formData.workPreferences.selectedSpecialties.length}개 직무 선택됨` 
                                  : '직무·직업을 선택하세요'}
                              </span>
                              <Search className="w-5 h-5 text-gray-400" />
                            </button>
                            
                            {(formData.workPreferences.selectedJobs.length > 0 || formData.workPreferences.selectedSpecialties.length > 0) && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-xl">
                                <p className="text-xs font-medium text-blue-800 mb-2">선택된 직무</p>
                                <div className="flex flex-wrap gap-2">
                                  {formData.workPreferences.selectedJobs.map(job => (
                                    <span key={job} className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs md:text-sm flex items-center gap-2 font-medium">
                                      {job}
                                      <button 
                                        onClick={() => setFormData(prevFormData => ({
                                                ...prevFormData,
                                                workPreferences: { // workPreferences 객체를 새로 만듭니다.
                                                    ...prevFormData.workPreferences, // 기존 workPreferences의 다른 속성(예: selectedAreas)을 유지
                                                    selectedJobs: toggleArrayItem(prevFormData.workPreferences.selectedJobs, job) // selectedJobs만 업데이트
                                                }
                                            }))}
                                            className="hover:bg-blue-200 rounded-full p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                  {formData.workPreferences.selectedSpecialties.map(spec => (
                                    <span key={spec} className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs md:text-sm flex items-center gap-2 font-medium">
                                      {spec}
                                      <button 
                                        onClick={() => setFormData(prevFormData => ({
                                            ...prevFormData,
                                            workPreferences: { // workPreferences 객체를 새로 만듭니다.
                                                ...prevFormData.workPreferences, // 기존 workPreferences의 다른 속성을 유지
                                                selectedSpecialties: toggleArrayItem(prevFormData.workPreferences.selectedSpecialties, spec) // selectedSpecialties만 업데이트
                                            }
                                        }))}
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

              

              {/* 근무형태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">근무형태</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['아르바이트', '계약직', '정규직', '인턴십', '프리랜서'].map(type => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.workPreferences.workType.includes(type)}
                        onChange={(e) => {
                          const newTypes = e.target.checked 
                            ? [...formData.workPreferences.workType, type]
                            : formData.workPreferences.workType.filter(t => t !== type);
                          setFormData(prev => ({
                            ...prev,
                            workPreferences: {
                              ...prev.workPreferences,
                              workType: newTypes
                            }
                          }));
                        }}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">* 이력서 공개 시 선택한 근무형태의 대한 근무지로 노출됩니다.</p>
              </div>

              {/* 근무기간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">근무기간</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['3개월 이하', '3개월~6개월', '6개월~1년', '1년이상'].map(period => (
                    <button
                      key={period}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        workPreferences: {
                          ...prev.workPreferences,
                          workPeriod: period
                        }
                      }))}
                      className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.workPreferences.workPeriod === period
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    workPreferences: {
                      ...prev.workPreferences,
                      workPeriod: '기간무관'
                    }
                  }))}
                  className={`mt-2 px-3 py-2 text-sm rounded-lg border-2 transition-colors ${formData.workPreferences.workPeriod === '기간무관' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'}`}
                >
                  기간무관 
                </button> 
              </div>

              {/* 근무요일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">근무요일</label>
                <div className="grid grid-cols-3 gap-3">
                  {['평일', '주말', '요일무관'].map(day => (
                    <button
                      key={day}
                      onClick={() => {
                        let newDays = [...formData.workPreferences.workDays];

                        if (day === '요일무관') {
                          // '요일무관'을 클릭하면, '요일무관'만 선택되거나 해제됩니다.
                          newDays = newDays.includes('요일무관') ? [] : ['요일무관'];
                        } else {
                          // '평일' 또는 '주말'을 클릭하면 '요일무관'은 해제됩니다.
                          newDays = newDays.filter(d => d !== '요일무관');
                          
                          // 클릭한 요일을 토글합니다.
                          if (newDays.includes(day)) {
                            newDays = newDays.filter(d => d !== day);
                          } else {
                            newDays.push(day);
                          }
                        }
                        
                        setFormData(prev => ({
                          ...prev,
                          workPreferences: {
                            ...prev.workPreferences,
                            workDays: newDays
                          },
                        }));
                      }}
                      className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.workPreferences.workDays.includes(day)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>     
            </div>
          </div>

          {/* 학력 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">학력</h2>
            </div>

            {formData.educations.map((education, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">학력 {index + 1}</h3>
                  </div>
                  {formData.educations.length > 1 && (
                    <button
                      onClick={() => removeEducation(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">학위 종류</label>
                    <select
                      value={education.degree}
                      onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="초등학교">초등학교</option>
                      <option value="중학교">중학교</option>
                      <option value="고등학교">고등학교</option>
                      <option value="대학(2,3년)">대학(2,3년)</option>
                      <option value="대학(4년)">대학(4년)</option>
                      <option value="대학원">대학원</option>
                    </select>
                  </div>
                  {education.degree === '대학원' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">세부 학위</label>
                      <select
                        value={education.subDegree || '석사'} // 기본값 석사
                        onChange={(e) => updateEducation(index, 'subDegree', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="석사">석사</option>
                        <option value="박사">박사</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">학교명</label>
                    <input
                      type="text"
                      value={education.school}
                      onChange={(e) => updateEducation(index, 'school', e.target.value)}
                      placeholder="학교명을 입력해주세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">전공</label>
                    <input
                      type="text"
                      value={education.major}
                      onChange={(e) => updateEducation(index, 'major', e.target.value)}
                      placeholder="전공을 입력해주세요" // 전공 필드를 유지
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">입학년도</label>
                    <select
                      value={education.entryYear}
                      onChange={(e) => updateEducation(index, 'entryYear', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">입학년도</option>
                      {Array.from({ length: 2030 - 1997 + 1 }, (_, i) => 1997 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">졸업년도</label>
                    <select
                      value={education.graduationYear}
                      onChange={(e) => updateEducation(index, 'graduationYear', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      disabled={education.status === '재학중' || education.status === '휴학중'}
                    >
                      <option value="">졸업년도</option>
                      {Array.from({ length: 2030 - 1997 + 1 }, (_, i) => 1997 + i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={addEducation}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <span className="text-gray-600 font-medium">+ 학력 추가</span>
            </button>
          </div>

          {/* 자기소개서 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">자기소개서</h2>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  자기소개
                </label>
                <button
                  onClick={() => enhanceTextWithGemini('selfIntroduction', formData.selfIntroduction)}
                  disabled={isGenerating.selfIntroduction}
                  className="flex items-center gap-1 text-purple-600 hover:text-purple-700 text-sm font-medium disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  {isGenerating.selfIntroduction ? 'AI 작성 중...' : 'AI로 개선'}
                </button>
              </div>
              <textarea
                value={formData.selfIntroduction}
                onChange={(e) => handleChange('selfIntroduction', e.target.value)}
                placeholder="자기소개 내용을 입력해주세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-32 resize-none"
              />
              {formData.selfIntroductionEnhanced && (
                <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 text-purple-700 font-medium text-sm mb-2">
                    <Sparkles size={16} />
                    AI 개선 버전
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{formData.selfIntroductionEnhanced}</p>
                </div>
              )}
            </div>
          </div>

          {/* 경력사항 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">경력</h2>
            </div>

            {/* 기존 경력 목록 */}
            {formData.careers.map((career, index) => (
              <div key={career.id || index} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{career.company} {career.position}</h3>
                      <p className="text-sm text-gray-600">
                        {career.startDate} ~ {career.isCurrent ? '현재' : career.endDate} (정규직)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">수정</button>
                    <button 
                      onClick={() => removeCareer(career.id)}
                      className="text-red-600 hover:text-red-700 text-sm font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 ml-10">{career.description}</p>
              </div>
            ))}

            {/* 경력 추가 버튼 */}
            <button
              onClick={() => setTempCareer({
                company: '',
                position: '',
                department: '',
                startDate: '',
                endDate: '',
                isCurrent: false,
                description: ''
              })}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <span className="text-gray-600 font-medium">+ 경력 추가</span>
            </button>

            {/* 경력 추가 폼 (임시) */}
            {tempCareer && Object.keys(tempCareer).length > 0 && (
              <div className="mt-4 p-4 border border-blue-200 rounded-lg bg-blue-50">
                <h4 className="font-medium mb-4">새 경력 추가</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">회사명</label>
                      <input
                        type="text"
                        value={tempCareer.company}
                        onChange={(e) => setTempCareer(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="회사명을 입력해주세요"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
                      <input
                        type="text"
                        value={tempCareer.position}
                        onChange={(e) => setTempCareer(prev => ({ ...prev, position: e.target.value }))}
                        placeholder="직책을 입력해주세요"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                    <input
                      type="date"
                      value={tempCareer.startDate}
                      onChange={(e) => setTempCareer(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                    <input
                      type="date"
                      value={tempCareer.endDate}
                      onChange={(e) => setTempCareer(prev => ({ ...prev, endDate: e.target.value }))}
                      disabled={tempCareer.isCurrent}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                
                {/* 현재 재직중 체크박스 */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tempCareer.isCurrent}
                    onChange={(e) => setTempCareer(prev => ({ ...prev, isCurrent: e.target.checked }))}
                    className="text-blue-600"
                  />
                  <span className="text-sm">현재 재직중</span>
                </label>
                
                {/* 업무 설명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업무 설명</label>
                  <textarea
                    value={tempCareer.description}
                    onChange={(e) => setTempCareer(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="담당 업무를 설명해주세요"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  />
                </div>
                
                {/* 버튼들 */}
                <div className="flex gap-2">
                  <button
                    onClick={addCareer}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setTempCareer({})}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>

          {/* 외국어능력 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">외국어능력</h2>
            </div>

            {/* 기존 외국어 목록 */}
            {formData.languages.map((lang, index) => (
              <div key={lang.id || index} className="border border-gray-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{lang.language} - {lang.level}</h3>
                    {lang.testName && (
                      <p className="text-sm text-gray-600">{lang.testName}: {lang.score}점 ({lang.date})</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeLanguage(lang.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {/* 외국어 추가 버튼 */}
            <button
              onClick={() => setShowLanguageModal(true)}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <span className="text-gray-600 font-medium">+ 외국어 추가</span>
            </button>
          </div>

          {/* 컴퓨터활용능력 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">컴퓨터활용능력</h2>
              <button className="ml-auto text-blue-600 hover:text-blue-700 text-sm">초기화</button>
            </div>

            <div className="space-y-4">
              {Object.entries(computerPrograms).map(([program, levels]) => (
                <div key={program} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    {program === '워드' && <FileText className="w-6 h-6 text-blue-600" />}
                    {program === '엑셀' && <Monitor className="w-6 h-6 text-green-600" />}
                    {program === '파워포인트' && <Star className="w-6 h-6 text-red-600" />}
                    {program === '인터넷' && <Globe className="w-6 h-6 text-purple-600" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-2">{program}</h3>
                    <div className="flex gap-2">
                      {levels.map(level => (
                        <button
                          key={level}
                          onClick={() => {
                            const existingSkill = formData.computerSkills.find(skill => skill.program === program);
                            if (existingSkill) {
                              setFormData(prev => ({
                                ...prev,
                                computerSkills: prev.computerSkills.map(skill =>
                                  skill.program === program ? { ...skill, level } : skill
                                )
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                computerSkills: [...prev.computerSkills, { program, level, id: Date.now() }]
                              }));
                            }
                          }}
                          className={`px-3 py-1 text-sm rounded-lg border-2 transition-colors ${
                            formData.computerSkills.find(skill => skill.program === program)?.level === level
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 w-24 text-right">
                    {(() => {
                      const selectedSkill = formData.computerSkills.find(skill => skill.program === program);
                      if (!selectedSkill) return '선택 안됨'; // 선택된 레벨이 없을 경우
                      if (selectedSkill.level === '상' || selectedSkill.level === '중') return '기본문서 작성';
                      if (selectedSkill.level === '하') return '사용미숙';
                      return ''; // 예상치 못한 레벨일 경우
                    })()}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">기타 활용 능력</h4>
              <textarea
                placeholder="기타 컴퓨터 활용 능력을 입력해 주세요. (예: 포토샵, 웹디자인, 동영상 편집 등)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <span></span>
                <span className="text-xs text-gray-500">0/500</span>
              </div>
            </div>
          </div>

          {/* 자격증 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">자격증</h2>
              <div className="ml-auto text-sm text-gray-500">선택한 자격증이 대표자격증으로 노출됩니다.</div>
            </div>

            {/* 기존 자격증 목록 */}
            {formData.certificates.length > 0 && (
              <div className="mb-6">
                {formData.certificates.map((cert, index) => (
                  <div key={cert.id || index} className="border border-blue-200 rounded-lg p-4 mb-3 bg-blue-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg text-blue-900">{cert.name}</h3>
                        <p className="text-sm text-blue-700">{cert.issuer}, {cert.date}</p>
                        {cert.score && <p className="text-sm text-blue-600">점수: {cert.score}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">수정</button>
                        <button 
                          onClick={() => removeCertificate(cert.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 자격증 추가 폼 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">자격증 명</label>
                <input
                  type="text"
                  value={tempCertificate.name}
                  onChange={(e) => setTempCertificate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="운전면허증"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">발행처</label>
                  <input
                    type="text"
                    value={tempCertificate.issuer}
                    onChange={(e) => setTempCertificate(prev => ({ ...prev, issuer: e.target.value }))}
                    placeholder="기타"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">취득년도</label>
                  <select
                    value={tempCertificate.date}
                    onChange={(e) => setTempCertificate(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">취득년도</option>
                    {Array.from({length: 30}, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  onClick={() => setTempCertificate({ name: '', issuer: '', date: '', score: '' })}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  취소
                </button>
                <button
                  onClick={addCertificate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
              </div>
            </div>
          </div>

          {/* 특기사항 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-pink-500 to-pink-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">특기사항</h2>
              <button className="ml-auto text-blue-600 hover:text-blue-700 text-sm">초기화</button>
            </div>

            <div className="mb-6 text-sm text-gray-600">
              선택하신 업무중에 관련된 스킬을 추천해 드려요.
              <span className="text-blue-600 ml-2">3/5</span>
            </div>

            {/* 추천 특기사항 버튼들 */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                '문서작성 잘함', 'PC조리/설치 능숙', '자동차운전 능숙', '숫자 계산이 빠름',
                '말솜씨가 좋음', '체력이 좋음', '목소리가 좋음', '손이 빠름',
                '사교성이 좋음', '인성성이 좋음', '약속을 잘 지킴', '정리정돈을 잘함',
                '패션 센스가 좋음', '요리솜씨가 좋음', '행동이 민첩', '일처리가 꼼꼼함',
                '작문시 문장력 좋음', '사진촬영 수준급', '기억력이 좋음', '끈기가 있음',
                '다재다능함'
              ].map(skill => (
                <button
                  key={skill}
                  onClick={() => {
                    const isSelected = formData.specialties.some(spec => spec.title === skill);
                    if (isSelected) {
                      setFormData(prev => ({
                        ...prev,
                        specialties: prev.specialties.filter(spec => spec.title !== skill)
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        specialties: [...prev.specialties, { title: skill, content: '', id: Date.now() }]
                      }));
                    }
                  }}
                  className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                    formData.specialties.some(spec => spec.title === skill)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>

            {/* 기타 보유 기술 */}
            <div>
              <h4 className="font-medium mb-2">그 외 보유 기술</h4>
              <textarea
                value={tempSpecialty.content}
                onChange={(e) => setTempSpecialty(prev => ({ ...prev, content: e.target.value }))}
                placeholder="기타 능력들을 직접 입력해 주세요."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-32 resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <span></span>
                <span className="text-xs text-gray-500">0/500</span>
              </div>
            </div>
          </div>

          {/* 포트폴리오 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">포트폴리오</h2>
              <div className="ml-auto text-sm text-gray-500 flex items-center gap-1">
                <span>💡</span>
                <span>이미지, PDF, URL 등을 등록할 수 있습니다.</span>
              </div>
            </div>

            {/* 기존 포트폴리오 목록 */}
            {formData.portfolios.length > 0 && (
              <div className="mb-6 space-y-4">
                {formData.portfolios.map((portfolio, index) => (
                  <div key={portfolio.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          {portfolio.type === 'file' ? (
                            portfolio.fileName?.toLowerCase().includes('.pdf') ? (
                              <FileText className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Camera className="w-5 h-5 text-indigo-600" />
                            )
                          ) : (
                            <Globe className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900">{portfolio.name}</h3>
                          <p className="text-sm text-gray-600">
                            {portfolio.type === 'file' ? portfolio.fileName : portfolio.url}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-1 text-xs rounded-lg ${
                              portfolio.isPublic 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {portfolio.isPublic ? '공개' : '비공개'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => window.open(portfolio.url, '_blank')}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          보기
                        </button>
                        <button 
                          onClick={() => removePortfolio(portfolio.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.portfolios.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>등록된 포트폴리오가 없습니다.</p>
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-gray-500 mb-4">
                ※ 이미지, PDF 파일 또는 URL을 등록할 수 있습니다.
              </p>
              <button 
                onClick={() => setShowPortfolioModal(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-600 font-medium">+ 포트폴리오 추가</span>
              </button>
            </div>
          </div>

         {/* 포토앨범 섹션 */}
<div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
    <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
        <h2 className="text-lg md:text-xl font-bold text-gray-900">포토앨범</h2>
    </div>

    <div className="mb-4 text-sm text-gray-600">
        사진추가 후 이력서에 공개할 사진을 선택해 주세요.
    </div>

    <div className="grid grid-cols-5 gap-4 mb-6">
        {/* 1. 업로드된 사진 목록 */}
        {photoAlbum.map((photo) => (
            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group">
                {/* 이미지 미리보기 */}
                <img 
                    src={photo.url} 
                    alt="Uploaded Photo" 
                    className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80"
                />
                
                {/* 오버레이 (삭제/공개 버튼) */}
                <div className="absolute inset-0 flex flex-col justify-end bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                    
                
                    {/* 삭제 버튼 */}
                    <button
                        onClick={() => removePhoto(photo.id)}
                        className="p-1 w-full bg-red-500 text-white rounded-md hover:bg-red-600 text-xs font-semibold"
                    >
                        삭제
                    </button>
                </div>
            
            </div>
        ))}

        {/* 2. 추가 슬롯 (업로드 버튼) */}
        {photoAlbum.length < 5 && (
            <div 
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 hover:border-blue-500 hover:bg-blue-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef2.current?.click()} // 💡 클릭 시 파일 인풋 트리거
            >
                <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/gif" 
                    ref={fileInputRef2} 
                    onChange={handleImageUpload2} 
                    multiple={false} // 한 번에 한 개씩만 업로드
                    className="hidden" // 숨김
                />
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-500 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-sm text-blue-600 font-medium mt-1 block">추가 ({photoAlbum.length}/5)</span>
                </div>
            </div>
        )}
        
        {/* 3. 나머지 빈 슬롯 (총 5개를 채우기 위함) */}
        {Array.from({length: 5 - photoAlbum.length}).map((_, i) => (
            <div 
                key={`empty-${i}`} 
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
        ))}
    </div>

    <div className="text-xs text-gray-500 space-y-1">
        <p>• 공개되는 사진을 제외한 포토앨범 목록은 모든 이력서에 등록하게 적용됩니다.</p>
        <p>• 6MB 이하의 JPG, GIF, PNG 파일을 사이즈는 600*400이 적당합니다.</p>
    </div>
</div>

          {/* 취업우대사항 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">취업우대사항</h2>
              <button className="ml-auto text-blue-600 hover:text-blue-700 text-sm">초기화</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">장애여부</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="disability" 
                      value="비장애" 
                      checked={formData.employmentPreferences.disability === '비장애'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          disability: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">비장애</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="disability" 
                      value="장애" 
                      checked={formData.employmentPreferences.disability === '장애'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          disability: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">장애</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">병역여부</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="military" 
                      value="미필" 
                      checked={formData.employmentPreferences.military === '미필'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          military: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">미필</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="military" 
                      value="군필" 
                      checked={formData.employmentPreferences.military === '군필'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          military: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">군필</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="military" 
                      value="면제" 
                      checked={formData.employmentPreferences.military === '면제'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          military: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">면제</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">국가보훈</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="veteran" 
                      value="비대상" 
                      checked={formData.employmentPreferences.veteran === '비대상'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          veteran: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">비대상</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="veteran" 
                      value="대상" 
                      checked={formData.employmentPreferences.veteran === '대상'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          veteran: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">대상</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">고용지원금</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="subsidy" 
                      value="비대상" 
                      checked={formData.employmentPreferences.subsidy === '비대상'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          subsidy: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">비대상</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="subsidy" 
                      value="대상" 
                      checked={formData.employmentPreferences.subsidy === '대상'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        employmentPreferences: {
                          ...prev.employmentPreferences,
                          subsidy: e.target.value
                        }
                      }))}
                      className="text-blue-600" 
                    />
                    <span className="text-sm">대상</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 이력서 설정 섹션 */}
          <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
              <div className="flex-1 flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">이력서 설정</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">기업으로부터 알바제의를 받겠습니다.</span>
                  <button
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      resumeSettings: {
                        ...prev.resumeSettings,
                        isPublic: !prev.resumeSettings.isPublic
                      }
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.resumeSettings.isPublic ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.resumeSettings.isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* 공개 여부 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-800">연락처 공개 설정</h3>
                    <p className="text-sm text-gray-600">기업이 회원님의 이력서를 열람하고 연락할 수 있습니다.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">연락처 공개 (안심번호 사용)</span>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          allowContact: !prev.resumeSettings.allowContact
                        }
                      }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        formData.resumeSettings.allowContact ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.resumeSettings.allowContact ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 추가 연락 정보 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.resumeSettings.contactMethod === 'email'}
                        onChange={() => setFormData(prev => ({
                          ...prev,
                          resumeSettings: {
                            ...prev.resumeSettings,
                            contactMethod: 'email'
                          }
                        }))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">이메일</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={formData.resumeSettings.contactMethod === 'homepage'}
                        onChange={() => setFormData(prev => ({
                          ...prev,
                          resumeSettings: {
                            ...prev.resumeSettings,
                            contactMethod: 'homepage'
                          }
                        }))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">홈페이지</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          publicPeriod: 90
                        }
                      }))}
                      className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.resumeSettings.publicPeriod === 90
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      90일간
                    </button>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          publicPeriod: 60
                        }
                      }))}
                      className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.resumeSettings.publicPeriod === 60
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      60일간
                    </button>
                    <button
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          publicPeriod: 30
                        }
                      }))}
                      className={`px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
                        formData.resumeSettings.publicPeriod === 30
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      30일간
                    </button>
                    <div className="text-sm text-blue-600 font-medium flex items-center">
                      공개종료일: ~{(() => {
                        const endDate = new Date();
                        endDate.setDate(endDate.getDate() + formData.resumeSettings.publicPeriod);
                        return endDate.toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }).replace(/\./g, '.').slice(0, -1);
                      })()}
                    </div>
                  </div>
                </div>

                {/* 통화가능 시간 */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-4">통화가능 시간</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">시작시간</span>
                    </div>
                    <select
                      value={formData.resumeSettings.availableTime.startTime}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          availableTime: {
                            ...prev.resumeSettings.availableTime,
                            startTime: e.target.value
                          }
                        }
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {Array.from({length: 24}, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return <option key={hour} value={`${hour}:00`}>{hour}:00</option>;
                      })}
                    </select>
                    
                    <span className="text-gray-500">~</span>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">마감시간</span>
                    </div>
                    <select
                      value={formData.resumeSettings.availableTime.endTime}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        resumeSettings: {
                          ...prev.resumeSettings,
                          availableTime: {
                            ...prev.resumeSettings.availableTime,
                            endTime: e.target.value
                          }
                        }
                      }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {Array.from({length: 24}, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return <option key={hour} value={`${hour}:00`}>{hour}:00</option>;
                      })}
                    </select>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 하단 버튼 영역 */}
        <div className="sticky bottom-0 mt-8 p-4 bg-white/80 backdrop-blur-sm rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-center items-center gap-4 w-full mx-auto max-w-4xl">
             <button
               onClick={!isDownloadingPdf ? downloadPDF : undefined}
               disabled={isDownloadingPdf || isSaving}
               className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-wait"
             >
               {isDownloadingPdf ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Download size={18} />}
               {isDownloadingPdf ? 'PDF 생성 중...' : 'PDF 다운로드'}
             </button>
            <button
              disabled={isSaving}
              onClick={() => router.push(`/resume/preview/${RESUME_ID}`)}
              className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
            >
              <Eye size={18} />
              미리보기
            </button>
            <button
              onClick={!isSaving ? handleManualSave : undefined}
              disabled={isSaving || !USER_ID}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors font-semibold text-white ${
                hasExistingData 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save size={18} />
              {isSaving ? '저장 중...' : hasExistingData ? '수정하기' : '저장하기'}
            </button>
        </div>



        {/* 희망업직종 선택 모달 */}
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
                                    ? formData.workPreferences.selectedJobs.includes(item)
                                    : formData.workPreferences.selectedSpecialties.includes(item);
                                  
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
                                            if (!isSelected && formData.workPreferences.selectedJobs.length >= 3) {
                                              alert('직무는 최대 3개까지 선택할 수 있습니다.');
                                              return;
                                            }
                                            setFormData(prevFormData => ({
                                                ...prevFormData, // 1. 최상위 formData 복사
                                                workPreferences: { // 2. workPreferences 객체를 새로 생성
                                                    ...prevFormData.workPreferences, // 3. workPreferences의 다른 속성 유지
                                                    selectedJobs: toggleArrayItem(prevFormData.workPreferences.selectedJobs, item) // 4. selectedJobs 업데이트
                                                }
                                            }));
                                          } else {
                                            // selectedSpecialties 7개 제한
                                            if (!isSelected && formData.workPreferences.selectedSpecialties.length >= 7) {
                                              alert('전문분야는 최대 7개까지 선택할 수 있습니다.');
                                              return;
                                            }
                                           setFormData(prevFormData => ({
                                              ...prevFormData, // 1. 최상위 formData 복사
                                              workPreferences: { // 2. workPreferences 객체를 새로 생성
                                                  ...prevFormData.workPreferences, // 3. workPreferences의 다른 속성 유지
                                                  selectedSpecialties: toggleArrayItem(prevFormData.workPreferences.selectedSpecialties, item) // 4. selectedSpecialties 업데이트
                                              }
                                          }));
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
                          직무 <span className="font-bold text-blue-600">{formData.workPreferences.selectedJobs.length}/3</span>개, 
                          전문분야 <span className="font-bold text-green-600">{formData.workPreferences.selectedSpecialties.length}/7</span>개
                          <span className="text-xs text-gray-500 ml-2">(총 {formData.workPreferences.selectedJobs.length + formData.workPreferences.selectedSpecialties.length}/10개)</span>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                          <button
                            onClick={() => {
                              setFormData(prevFormData => ({
                                ...prevFormData, // 1. 최상위 formData의 모든 속성을 복사 (workPreferences 외의 다른 필드 유지)
                                workPreferences: { // 2. workPreferences 객체를 새로 생성
                                    ...prevFormData.workPreferences, // 3. workPreferences의 다른 속성을 유지
                                    selectedJobs: [], // 4. selectedJobs를 빈 배열로 초기화
                                    selectedSpecialties: [] // 5. selectedSpecialties를 빈 배열로 초기화
                                }
                            }));
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

       {/* 희망근무지 선택 모달 */}
{showWorkLocationModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">희망근무지 선택 (최대 3개)</h3>
                        <p className="text-sm text-gray-600 mt-1">대분류 지역을 선택 후, 세부 지역을 선택하세요.</p>
                    </div>
                    <button
                        onClick={() => setShowWorkLocationModal(false)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
                    >
                        {/* <X size={24} /> (X 아이콘을 사용했다고 가정) */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* 본문: 2단 분할 레이아웃 */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                
                {/* 1단계: 대분류 지역 선택 (왼쪽 패널) */}
                <div className="w-full md:w-56 border-b md:border-b-0 md:border-r overflow-y-auto bg-gray-50 max-h-64 md:max-h-none">
                    {hierarchicalRegions.map(item => (
                        <button
                            key={item.region}
                            onClick={() => setSelectedParentRegion(item.region)}
                            className={`w-full px-4 md:px-6 py-3 md:py-4 text-left transition-all duration-200 text-sm md:text-base ${
                                selectedParentRegion === item.region
                                    ? 'bg-white text-blue-600 font-semibold border-l-4 border-blue-600 shadow-sm'
                                    : 'text-gray-700 hover:bg-white hover:text-gray-900'
                            }`}
                        >
                            {item.region}
                        </button>
                    ))}
                </div>

                {/* 2단계: 세부 지역 선택 (오른쪽 패널) */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    
                    {/* 지역 무관 옵션 */}
                    <div className="mb-6 pb-4 border-b">
                        <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border-2 transition-colors ${
                            formData.workPreferences.workLocation.regions.includes('지역무관')
                                ? 'border-red-500 bg-red-50 text-red-700'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                            <input
                                type="checkbox"
                                checked={formData.workPreferences.workLocation.regions.includes('지역무관')}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setFormData(prev => ({
                                        ...prev,
                                        workPreferences: {
                                            ...prev.workPreferences,
                                            workLocation: {
                                                ...prev.workPreferences.workLocation,
                                                // 지역무관 선택 시 '지역무관'만, 해제 시 빈 배열
                                                regions: isChecked ? ['지역무관'] : [],
                                            }
                                        }
                                    }));
                                }}
                                className="text-red-600 w-5 h-5"
                            />
                            <span className="text-base font-bold">지역무관</span> {/* 💡 이 부분 수정 */}
                            <span className="text-xs text-gray-500 ml-auto">전국 어디든 근무 가능</span>
                        </label>
                    </div>

                    {/* 선택된 대분류 지역의 세부 지역 리스트 */}
                    <h3 className="text-lg font-bold text-gray-800 mb-4">{selectedParentRegion}의 세부 지역</h3>
                    
                    <div className="flex flex-wrap gap-2 md:gap-3">
                        {hierarchicalRegions.find(item => item.region === selectedParentRegion)?.subRegions.map(subRegion => {
                            const isSelected = formData.workPreferences.workLocation.regions.includes(subRegion);
                            // '지역무관'이 선택되었거나, 이미 3개 선택된 상태라면 비활성화
                            const isAllAreaSelected = formData.workPreferences.workLocation.regions.includes('지역무관');
                            const isLimitReached = formData.workPreferences.workLocation.regions.length >= 3 && !isSelected;
                            const isDisabled = isAllAreaSelected || isLimitReached;

                            return (
                                <button
                                    key={subRegion}
                                    disabled={isDisabled} // 💡 비활성화 조건 적용
                                    onClick={() => {
                                        let currentRegions = formData.workPreferences.workLocation.regions;
                                        
                                        // 1. 지역무관이 선택되어 있었다면 해제
                                        if (currentRegions.includes('지역무관')) {
                                            currentRegions = currentRegions.filter(r => r !== '지역무관');
                                        }
                                        
                                        const newRegions = isSelected
                                            ? currentRegions.filter(r => r !== subRegion) // 선택 해제
                                            : [...currentRegions, subRegion].slice(0, 3); // 선택 추가 (최대 3개 제한)
                                        
                                        setFormData(prev => ({
                                            ...prev,
                                            workPreferences: {
                                                ...prev.workPreferences,
                                                workLocation: {
                                                    ...prev.workPreferences.workLocation,
                                                    regions: newRegions
                                                }
                                            }
                                        }));
                                    }}
                                    className={`px-3 py-2 text-sm rounded-lg border-2 transition-colors ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                                            : isDisabled
                                                ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' // 비활성화 스타일
                                                : 'border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    {subRegion}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 푸터 */}
            <div className="p-4 md:p-6 border-t bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-700">
                    <span className="font-semibold text-blue-600">선택된 지역: </span>
                    <span className="font-bold text-blue-600">{formData.workPreferences.workLocation.regions.length}/3개</span>
                </div>
                <button
                    onClick={() => setShowWorkLocationModal(false)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm md:text-base font-semibold shadow-lg transition-all duration-200"
                >
                    ✅ 완료
                </button>
            </div>

        </div>
    </div>
)}

        {/* 외국어능력 추가 모달 */}
        {showLanguageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">외국어능력 추가</h3>
                  <button
                    onClick={() => setShowLanguageModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">언어</label>
                    <input
                      type="text"
                      value={tempLanguage.language}
                      onChange={(e) => setTempLanguage(prev => ({ ...prev, language: e.target.value }))}
                      placeholder="예: 영어, 일본어, 중국어"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">수준</label>
                    <select
                      value={tempLanguage.level}
                      onChange={(e) => setTempLanguage(prev => ({ ...prev, level: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="초급">초급</option>
                      <option value="중급">중급</option>
                      <option value="고급">고급</option>
                      <option value="원어민">원어민</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">공인시험</label>
                    <select
                      value={tempLanguage.testName}
                      onChange={(e) => setTempLanguage(prev => ({ ...prev, testName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">선택해주세요</option>
                      {officialTests.map(test => (
                        <option key={test} value={test}>{test}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">점수</label>
                      <input
                        type="text"
                        value={tempLanguage.score}
                        onChange={(e) => setTempLanguage(prev => ({ ...prev, score: e.target.value }))}
                        placeholder="점수"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">취득일</label>
                      <input
                        type="date"
                        value={tempLanguage.date}
                        onChange={(e) => setTempLanguage(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={addLanguage}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setShowLanguageModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 포트폴리오 추가 모달 */}
        {showPortfolioModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-800">포트폴리오 추가</h3>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 타입 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">타입</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={tempPortfolio.type === 'file'}
                          onChange={() => setTempPortfolio(prev => ({ ...prev, type: 'file', url: '' }))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">파일 (이미지/PDF)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={tempPortfolio.type === 'link'}
                          onChange={() => setTempPortfolio(prev => ({ ...prev, type: 'link', file: null }))}
                          className="text-blue-600"
                        />
                        <span className="text-sm">URL 링크</span>
                      </label>
                    </div>
                  </div>

                  {/* 제목 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                    <input
                      type="text"
                      value={tempPortfolio.name}
                      onChange={(e) => setTempPortfolio(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="포트폴리오 제목을 입력해주세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* 파일 업로드 */}
                  {tempPortfolio.type === 'file' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">파일</label>
                      <input
                        type="file"
                        ref={fileInputRef3}
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              alert('파일 크기는 10MB 이하여야 합니다.');
                              return;
                            }
                            setTempPortfolio(prev => ({ ...prev, file }));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">이미지 또는 PDF 파일 (최대 10MB)</p>
                    </div>
                  )}

                  {/* URL 입력 */}
                  {tempPortfolio.type === 'link' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                      <input
                        type="url"
                        value={tempPortfolio.url}
                        onChange={(e) => setTempPortfolio(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://example.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* 공개 여부 */}
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={tempPortfolio.isPublic}
                        onChange={(e) => setTempPortfolio(prev => ({ ...prev, isPublic: e.target.checked }))}
                        className="text-blue-600"
                      />
                      <span className="text-sm">이력서에 공개</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={addPortfolio}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF 생성을 위한 숨겨진 템플릿 */}
        <div className="absolute -left-[9999px] -top-[9999px] w-[210mm]">
          <div id="resume-preview-for-pdf" className="p-12 bg-white">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                <FileText className="w-7 h-7 text-indigo-600" />
                이력서
              </h2>
            </div>

            {/* 지원자 정보 */}
            <div className="mb-12 pdf-section">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">지원자 정보</h2>
              </div>
              <div className="grid grid-cols-4 gap-6">
                {profileImageUrl && (
                  <div className="col-span-1">
                    <img src={profileImageUrl} alt="프로필" className="w-full aspect-[3/4] object-cover rounded-2xl border-2 border-gray-200 shadow-lg" crossOrigin="anonymous" />
                  </div>
                )}
                <div className={`${profileImageUrl ? 'col-span-3' : 'col-span-4'} grid grid-cols-2 gap-4`}>
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl"><User className="w-6 h-6 text-indigo-600" /><div><p className="text-sm text-gray-600">이름</p><p className="font-bold text-gray-900">{formData.name}</p></div></div>
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl"><Mail className="w-6 h-6 text-blue-600" /><div><p className="text-sm text-gray-600">이메일</p><p className="font-bold text-gray-900">{formData.email}</p></div></div>
                  <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl"><Phone className="w-6 h-6 text-purple-600" /><div><p className="text-sm text-gray-600">연락처</p><p className="font-bold text-gray-900">{formData.phone}</p></div></div>
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl"><Calendar className="w-6 h-6 text-green-600" /><div><p className="text-sm text-gray-600">생년월일</p><p className="font-bold text-gray-900">{formData.birthDate || '-'}</p></div></div>
                  {formData.address && (<div className="col-span-2 p-4 bg-orange-50 rounded-xl"><p className="text-sm text-gray-600">주소</p><p className="font-bold text-gray-900">{formData.address}</p></div>)}
                </div>
              </div>
            </div>

            {/* 자기소개서 */}
            {formData.selfIntroduction && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center"><BookOpen className="w-7 h-7 text-gray-600" /></div><h2 className="text-2xl font-bold text-gray-900">자기소개서</h2></div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200"><p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{formData.selfIntroduction}</p></div>
              </div>
            )}

            {/* 학력 */}
            {formData.educations?.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><GraduationCap className="w-7 h-7 text-purple-600" /></div><h2 className="text-2xl font-bold text-gray-900">학력사항</h2></div>
                <div className="space-y-4">
                  {formData.educations.map((edu, index) => (
                    <div key={index} className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1"><h3 className="text-xl font-bold text-gray-900 mb-1">{edu.degree} {edu.subDegree && `(${edu.subDegree})`} - {edu.school}</h3><p className="text-lg text-gray-700">{edu.major}</p></div>
                        <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">{edu.status}</span>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">{edu.entryYear && edu.graduationYear && <span className="font-medium">📅 {edu.entryYear} ~ {edu.graduationYear}</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 경력 */}
            {formData.careers?.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Briefcase className="w-7 h-7 text-blue-600" /></div><h2 className="text-2xl font-bold text-gray-900">경력사항</h2></div>
                <div className="space-y-4">
                  {formData.careers.map((career, index) => (
                    <div key={index} className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div><h3 className="text-xl font-bold text-gray-900">{career.company}</h3><p className="text-lg text-gray-700">{career.position} / {career.department}</p></div>
                        <p className="text-sm text-gray-500 font-medium">{career.startDate} ~ {career.isCurrent ? '현재' : career.endDate}</p>
                      </div>
                      <p className="text-gray-600">{career.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 희망근무조건 */}
            {formData.workPreferences && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><Heart className="w-7 h-7 text-green-600" /></div><h2 className="text-2xl font-bold text-gray-900">희망근무조건</h2></div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex"><strong className="w-28">근무기간:</strong> <span className="text-gray-700">{formData.workPreferences.workPeriod}</span></div>
                  <div className="flex"><strong className="w-28">근무요일:</strong> <span className="text-gray-700">{formData.workPreferences.workDays?.join(', ')}</span></div>
                  <div className="flex"><strong className="w-28">근무형태:</strong> <span className="text-gray-700">{formData.workPreferences.workType?.join(', ')}</span></div>
                  <div className="flex"><strong className="w-28">희망근무지:</strong> <span className="text-gray-700">{formData.workPreferences.workLocation?.regions?.join(', ')}</span></div>
                  <div className="md:col-span-2 flex"><strong className="w-28">희망업직종:</strong> <span className="text-gray-700">{(formData.workPreferences.selectedJobs || []).concat(formData.workPreferences.selectedSpecialties || []).join(', ')}</span></div>
                </div>
              </div>
            )}

            {/* 외국어 능력 */}
            {formData.languages && formData.languages.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center"><Globe className="w-7 h-7 text-orange-600" /></div><h2 className="text-2xl font-bold text-gray-900">외국어 능력</h2></div>
                <div className="space-y-3">
                  {formData.languages.map((lang, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                      <p className="font-bold text-gray-900">{lang.language} - <span className="font-medium text-orange-700">{lang.level}</span></p>
                      {lang.testName && <p className="text-sm text-gray-600">{lang.testName}: {lang.score} ({lang.date})</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 자격증 */}
            {formData.certificates && formData.certificates.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center"><Award className="w-7 h-7 text-yellow-600" /></div><h2 className="text-2xl font-bold text-gray-900">자격증</h2></div>
                <div className="space-y-3">
                  {formData.certificates.map((cert, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                      <p className="font-bold text-gray-900">{cert.name}</p>
                      <p className="text-sm text-gray-600">{cert.issuer} ({cert.date})</p>
                      {cert.score && <p className="text-sm text-gray-500">점수/등급: {cert.score}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 컴퓨터 활용능력 & 특기사항 */}
            <div className="grid md:grid-cols-2 gap-6 mb-12 pdf-section">
              {formData.computerSkills && formData.computerSkills.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 "><div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center"><Settings className="w-7 h-7 text-sky-600" /></div><h2 className="text-2xl font-bold text-gray-900">컴퓨터 능력</h2></div>
                  <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 space-y-2">
                    {formData.computerSkills.map((skill, index) => (
                      <div key={index} className="flex justify-between items-center"><span className="font-semibold">{skill.program}</span><span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">{skill.level}</span></div>
                    ))}
                  </div>
                </div>
              )}
              {formData.specialties && formData.specialties.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center"><Star className="w-7 h-7 text-pink-600" /></div><h2 className="text-2xl font-bold text-gray-900">특기사항</h2></div>
                  <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 flex flex-wrap gap-2">
                    {formData.specialties.map((spec, idx) => (<div key={idx} className="px-3 py-1.5 bg-pink-100 text-pink-800 rounded-lg font-medium text-sm">{spec.title}</div>))}
                  </div>
                </div>
              )}
            </div>

            {/* 포트폴리오 */}
            {formData.portfolios && formData.portfolios.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center"><LinkIcon className="w-7 h-7 text-cyan-600" /></div><h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2></div>
                <div className="space-y-3">
                  {formData.portfolios.map((portfolio, index) => (
                    <a key={portfolio.id || index} href={portfolio.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:bg-cyan-50 hover:border-cyan-300 transition-all">
                      <LinkIcon className="w-5 h-5 text-cyan-600" />
                      <p className="font-bold text-gray-900">{portfolio.name || portfolio.url}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 취업우대사항 */}
            {formData.employmentPreferences && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center"><User className="w-7 h-7 text-teal-600" /></div><h2 className="text-2xl font-bold text-gray-900">취업우대사항</h2></div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                  <div className="flex"><strong className="w-28">병역:</strong> <span className="text-gray-700">{formData.employmentPreferences.military}</span></div>
                  <div className="flex"><strong className="w-28">장애여부:</strong> <span className="text-gray-700">{formData.employmentPreferences.disability}</span></div>
                  <div className="flex"><strong className="w-28">국가보훈:</strong> <span className="text-gray-700">{formData.employmentPreferences.veteran}</span></div>
                  <div className="flex"><strong className="w-28">고용지원금:</strong> <span className="text-gray-700">{formData.employmentPreferences.subsidy}</span></div>
                </div>
              </div>
            )}

            {/* 포토앨범 */}
            {photoAlbum?.length > 0 && (
              <div className="mb-12 pdf-section">
                <div className="flex items-center gap-4 mb-6"><div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><Camera className="w-7 h-7 text-red-600" /></div><h2 className="text-2xl font-bold text-gray-900">포토앨범</h2></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {photoAlbum.slice(0, 5).map((photo) => (
                    <div key={photo.id} className="aspect-square relative overflow-hidden rounded-xl shadow-lg border-2 border-gray-100">
                      <img src={photo.url} alt="포토앨범 이미지" className="w-full h-full object-cover" crossOrigin="anonymous" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    
  );
};

export default ResumeBuilder;