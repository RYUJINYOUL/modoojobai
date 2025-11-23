"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  orderBy,
  getDoc 
} from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  Filter,
  Download,
  Eye,
  CheckSquare,
  Square,
  User,
  Calendar,
  Loader2,
  X,
  ArrowLeft,
  Bell,
  LinkIcon
} from 'lucide-react';
import { sendApplicationStatusNotification, sendBulkApplicationStatusNotifications } from '@/lib/push-notification-utils';

const STATUS_COLORS = {
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: '제출' },
  reviewed: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '검토중' },
  interview: { bg: 'bg-purple-100', text: 'text-purple-700', label: '면접' },
  accepted: { bg: 'bg-green-100', text: 'text-green-700', label: '합격' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: '불합격' }
};

interface Application {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  resume: {
    name: string;
    birthDate: string;
    phone: string;
    email: string;
    profileImageUrl: string | null;
    selfIntroduction?: string;
    portfolios?: Array<{
      id: number | string;
      fileName: string | null;
      isPublic: boolean;
      name: string;
      storagePath: string | null;
      type: "link" | "file";
      url: string;
    }>;
    educations: Array<{
      school: string;
      major: string;
      degree: string;
      subDegree?: string;
      entryYear: string;
      graduationYear: string;
      status: string;
    }>;
    careers: Array<{
      company: string;
      position: string;
      isCurrent: boolean;
    }>;
    workPreferences: {
      selectedJobs: string[];
    };
  };
  status: 'submitted' | 'reviewed' | 'interview' | 'accepted' | 'rejected';
  isChecked: boolean;
  createdAt: any;
}

export default function ApplicationManagerPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  // 데이터
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);

  // 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 필터
  const [filters, setFilters] = useState({
    status: 'all',
    education: 'all',
    ageMin: '',
    ageMax: '',
    keyword: ''
  });

  // 모달
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [sending, setSending] = useState(false);

  // 권한 체크 및 데이터 로드
  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    loadData();
  }, [uid, jobId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 채용공고 정보 가져오기
      const jobRef = doc(db, 'jobs', jobId);
      const jobSnap = await getDoc(jobRef);
      
      if (!jobSnap.exists()) {
        alert('채용공고를 찾을 수 없습니다.');
        router.push('/');
        return;
      }

      const jobData = { id: jobSnap.id, ...jobSnap.data() } as any;
      setJob(jobData);

      // 권한 체크
      if (jobData.userId && jobData.userId !== uid) {
        alert('⚠️ 이 채용공고를 관리할 권한이 없습니다.');
        router.push('/profile/recruit-manage');
        return;
      }

      // 지원서 가져오기
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef,
        where('jobId', '==', jobId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const apps: Application[] = [];
      
      snapshot.forEach((doc) => {
        apps.push({ id: doc.id, ...doc.data() } as Application);
      });

      setApplications(apps);
      setFilteredApplications(apps);
      
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 최종 학력 계산
  const getHighestEducation = (educations: Application['resume']['educations']) => {
    if (!educations || educations.length === 0) return null;

    const levelOrder: { [key: string]: number } = {
      '초등학교': 0,
      '중학교': 1,
      '고등학교': 2,
      '대학(2,3년)': 3,
      '대학(4년)': 4,
      '석사': 5,
      '박사': 6,
    };

    return educations.reduce((highest, current) => {
      if (!highest) return current;

      const getLevel = (edu: any) => {
        if (edu.subDegree === '박사') return 6;
        if (edu.subDegree === '석사') return 5;
        if (edu.degree === '대학(4년)') return 4;
        if (edu.degree === '대학(2,3년)') return 3;
        if (edu.degree === '고등학교') return 2;
        if (edu.degree === '중학교') return 1;
        if (edu.degree === '초등학교') return 0;
        return 0;
      };

      const highestLevel = getLevel(highest);
      const currentLevel = getLevel(current);

      return currentLevel > highestLevel ? current : highest;
    });
  };

  // 나이 계산
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      
      return age;
    } catch {
      return null;
    }
  };

  // 필터 적용
  useEffect(() => {
    let filtered = [...applications];

    if (filters.status !== 'all') {
      filtered = filtered.filter(app => app.status === filters.status);
    }

    if (filters.education !== 'all') {
      filtered = filtered.filter(app => {
        const highestEdu = getHighestEducation(app.resume.educations);
        if (!highestEdu) return false;
        
        switch (filters.education) {
          case '고졸':
            return highestEdu.degree === '고등학교';
          case '전문대':
            return highestEdu.degree === '대학(2,3년)';
          case '4년제':
            return highestEdu.degree === '대학(4년)';
          case '석사':
            return highestEdu.degree === '대학원' && highestEdu.subDegree === '석사';
          case '박사':
            return highestEdu.degree === '대학원' && highestEdu.subDegree === '박사';
          default:
            return true;
        }
      });
    }

    if (filters.ageMin || filters.ageMax) {
      filtered = filtered.filter(app => {
        const age = calculateAge(app.resume.birthDate);
        if (age === null) return false;
        
        if (filters.ageMin && age < parseInt(filters.ageMin)) return false;
        if (filters.ageMax && age > parseInt(filters.ageMax)) return false;
        
        return true;
      });
    }

    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      filtered = filtered.filter(app => {
        const searchText = `
          ${app.resume.name}
          ${app.resume.email}
          ${app.resume.selfIntroduction || ''}
          ${app.resume.educations.map(e => e.school + ' ' + e.major).join(' ')}
          ${app.resume.workPreferences?.selectedJobs?.join(' ')}
        `.toLowerCase();
        
        return searchText.includes(keyword);
      });
    }

    setFilteredApplications(filtered);
  }, [filters, applications]);

  // 전체 선택/해제
  const toggleAll = () => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplications.map(app => app.id)));
    }
  };

  // 개별 선택/해제
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 이력서 다운로드 (PDF)
  const downloadResume = async (app: Application) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text('이력서', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`이름: ${app.resume.name}`, 20, 40);
      doc.text(`생년월일: ${app.resume.birthDate}`, 20, 50);
      doc.text(`연락처: ${app.resume.phone}`, 20, 60);
      doc.text(`이메일: ${app.resume.email}`, 20, 70);
      
      doc.save(`${app.resume.name}_이력서.pdf`);
    } catch (error) {
      alert('PDF 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 🔔 일괄 상태 변경 + 알림 전송
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) {
      alert('상태를 변경할 지원자를 선택해주세요.');
      return;
    }

    const confirmed = window.confirm(
      `선택한 ${selectedIds.size}명의 상태를 '${STATUS_COLORS[newStatus as keyof typeof STATUS_COLORS].label}'(으)로 변경하고 알림을 전송하시겠습니까?`
    );

    if (!confirmed) return;

    setSending(true);

    try {
      const selectedApps = filteredApplications.filter(app => selectedIds.has(app.id));
      
      console.log(`${selectedApps.length}명의 상태를 '${newStatus}'로 변경 중...`);
      
      // Firestore 업데이트
      const updatePromises = selectedApps.map(async (app) => {
        const appRef = doc(db, 'applications', app.id);
        return updateDoc(appRef, { 
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      });
      
      await Promise.all(updatePromises);

      // 🔔 알림 전송
      try {
        await sendBulkApplicationStatusNotifications(
          selectedApps.map(app => ({
            userId: app.userId,
            applicationId: app.id,
            jobTitle: app.jobTitle
          })),
          selectedApps[0]?.status || 'submitted',
          newStatus
        );
        console.log('✅ 알림 전송 완료');
      } catch (notificationError) {
        console.error('알림 전송 실패 (상태는 변경됨):', notificationError);
      }

      // 로컬 상태 업데이트
      setApplications(prevApps => 
        prevApps.map(app => 
          selectedIds.has(app.id) ? { ...app, status: newStatus as any } : app
        )
      );

      const statusLabel = STATUS_COLORS[newStatus as keyof typeof STATUS_COLORS].label;
      alert(`✅ ${selectedApps.length}명의 상태가 '${statusLabel}'(으)로 변경되고 알림이 전송되었습니다.`);

      setShowStatusModal(false);
      setSelectedIds(new Set());
      
    } catch (error) {
      console.error('상태 변경 실패:', error);
      alert('상태 변경 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  // 🔔 개별 상태 변경 + 알림 전송
  const updateStatus = async (appId: string, newStatus: string) => {
    try {
      const app = applications.find(a => a.id === appId);
      if (!app) return;

      const oldStatus = app.status;

      const appRef = doc(db, 'applications', appId);
      await updateDoc(appRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      // 🔔 알림 전송
      try {
        await sendApplicationStatusNotification({
          userId: app.userId,
          applicationId: app.id,
          jobTitle: app.jobTitle,
          oldStatus,
          newStatus
        });
        console.log('✅ 알림 전송 완료');
      } catch (notificationError) {
        console.error('알림 전송 실패 (상태는 변경됨):', notificationError);
      }

      // 로컬 상태 업데이트
      setApplications(apps => 
        apps.map(a => 
          a.id === appId ? { ...a, status: newStatus as any } : a
        )
      );
      
      alert('✅ 상태가 업데이트되고 알림이 전송되었습니다.');
    } catch (error) {
      alert('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl font-semibold">지원서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 뒤로가기 */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/profile/recruit-manage')}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition font-semibold text-lg"
          >
            <ArrowLeft className="w-6 h-6" />
            채용공고 관리로 돌아가기
          </button>
        </div>

        {/* 헤더 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{job?.title}</h1>
              <p className="text-gray-600 text-lg">
                총 <span className="font-bold text-indigo-600">{applications.length}</span>명 지원 / 
                필터 결과 <span className="font-bold text-purple-600">{filteredApplications.length}</span>명
              </p>
            </div>
            
            {selectedIds.size > 0 && (
              <button
                onClick={() => setShowStatusModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:from-indigo-700 hover:to-purple-700 font-bold shadow-lg transition-all"
              >
                <Bell className="w-5 h-5" />
                선택한 {selectedIds.size}명 상태 변경 + 알림
              </button>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">필터</h2>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="all">전체 상태</option>
              <option value="submitted">제출</option>
              <option value="reviewed">검토중</option>
              <option value="interview">면접</option>
              <option value="accepted">합격</option>
              <option value="rejected">불합격</option>
            </select>

            <select
              value={filters.education}
              onChange={(e) => setFilters(f => ({ ...f, education: e.target.value }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="all">전체 학력</option>
              <option value="고졸">고졸</option>
              <option value="전문대">전문대</option>
              <option value="4년제">4년제</option>
              <option value="석사">석사</option>
              <option value="박사">박사</option>
            </select>

            <input
              type="number"
              placeholder="최소 나이"
              value={filters.ageMin}
              onChange={(e) => setFilters(f => ({ ...f, ageMin: e.target.value }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="최대 나이"
              value={filters.ageMax}
              onChange={(e) => setFilters(f => ({ ...f, ageMax: e.target.value }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />

            <input
              type="text"
              placeholder="검색 (이름, 학교, 기술)"
              value={filters.keyword}
              onChange={(e) => setFilters(f => ({ ...f, keyword: e.target.value }))}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 지원자 리스트 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
          {/* 테이블 헤더 */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b-2 border-indigo-200">
            <div className="grid grid-cols-12 gap-4 p-4 font-bold text-gray-700">
              <div className="col-span-1 flex items-center justify-center pl-2">
                <button onClick={toggleAll} className="hover:scale-110 transition">
                  {selectedIds.size === filteredApplications.length && filteredApplications.length > 0 ? (
                    <CheckSquare className="w-6 h-6 text-indigo-600" />
                  ) : (
                    <Square className="w-6 h-6 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="col-span-2">지원자 정보</div>
              <div className="col-span-2">학력/경력</div>
              <div className="col-span-3">자기소개/포트폴리오</div>
              <div className="col-span-1">상태</div>
              <div className="col-span-1">제출일</div>
              <div className="col-span-2 text-center">작업</div>
            </div>
          </div>

          {/* 테이블 바디 */}
          <div className="divide-y divide-gray-200">
            {filteredApplications.length === 0 ? (
              <div className="p-20 text-center">
                <p className="text-gray-500 text-xl">조건에 맞는 지원자가 없습니다.</p>
              </div>
            ) : (
              filteredApplications.map((app) => {
                const age = calculateAge(app.resume.birthDate);
                const highestEdu = getHighestEducation(app.resume.educations);
                const latestCareer = app.resume.careers?.find(c => c.isCurrent) || app.resume.careers?.[0];
                const statusInfo = STATUS_COLORS[app.status];
                
                return (
                  <div 
                    key={app.id} 
                    className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition items-center"
                  >
                    {/* 체크박스 */}
                    <div className="col-span-1 flex items-center justify-center pl-2">
                      <button 
                        onClick={() => toggleSelect(app.id)}
                        className="hover:scale-110 transition p-2"
                      >
                        {selectedIds.has(app.id) ? (
                          <CheckSquare className="w-6 h-6 text-indigo-600" />
                        ) : (
                          <Square className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* 지원자 정보 */}
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {app.resume.profileImageUrl ? (
                          <img 
                            src={app.resume.profileImageUrl} 
                            alt={app.resume.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                            <User className="w-6 h-6 text-indigo-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-base">{app.resume.name}</p>
                        <p className="text-sm text-gray-600">
                          {age ? `${age}세` : '-'}
                        </p>
                      </div>
                    </div>

                    {/* 학력/경력 */}
                    <div className="col-span-2 text-sm">
                      {highestEdu ? (
                        <p className="text-gray-800 truncate">
                          <span className="font-semibold">{highestEdu.school}</span> ({highestEdu.degree})
                        </p>
                      ) : <p className="text-gray-500">-</p>}
                      <p className="text-gray-600 truncate">
                        {latestCareer 
                          ? `${latestCareer.company} (${latestCareer.position})`
                          : '경력 없음'
                        }
                      </p>
                    </div>

                    {/* 자기소개/포트폴리오 */}
                    <div className="col-span-3 text-sm">
                      {app.resume.selfIntroduction ? (
                        <p className="text-gray-700 line-clamp-2">
                          {app.resume.selfIntroduction}
                        </p>
                      ) : <p className="text-gray-400 italic">자기소개서 없음</p>}
                      
                      {app.resume.portfolios && app.resume.portfolios.length > 0 && (
                        <div className="flex items-center gap-2 mt-1 text-blue-600">
                          <LinkIcon className="w-3 h-3" />
                          <span className="font-semibold">포트폴리오 {app.resume.portfolios.length}개</span>
                        </div>
                      )}
                    </div>

                    {/* 상태 */}
                    <div className="col-span-1">
                      <select
                        value={app.status}
                        onChange={(e) => updateStatus(app.id, e.target.value)}
                        className={`w-full px-2 py-1 rounded-lg font-semibold text-sm ${statusInfo.bg} ${statusInfo.text} border-2 border-transparent focus:border-indigo-500 focus:outline-none cursor-pointer`}
                      >
                        <option value="submitted">제출</option>
                        <option value="reviewed">검토중</option>
                        <option value="interview">면접</option>
                        <option value="accepted">합격</option>
                        <option value="rejected">불합격</option>
                      </select>
                    </div>

                    {/* 제출일 */}
                    <div className="col-span-1 text-center text-sm text-gray-600">
                      {app.createdAt?.toDate 
                        ? app.createdAt.toDate().toLocaleDateString('ko-KR')
                        : '-'}
                    </div>

                    {/* 작업 버튼 */}
                    <div className="col-span-2 flex gap-2 justify-center">
                      <button
                        onClick={() => router.push(`/applications/${app.id}`)}
                        className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                        title="상세보기"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      
                      <button
                        onClick={() => downloadResume(app)}
                        className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                        title="다운로드"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 🔔 일괄 상태 변경 모달 (알림 포함) */}
      {showStatusModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowStatusModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Bell className="w-8 h-8 text-indigo-600" />
                {selectedIds.size}명의 상태 변경 + 알림 전송
              </h2>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              선택한 지원자들의 상태를 일괄 변경하고 푸시 알림을 전송합니다.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleBulkStatusChange('reviewed')}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Eye className="w-6 h-6" />}
                검토중으로 변경 + 알림
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatusChange('interview')}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Calendar className="w-6 h-6" />}
                면접으로 변경 + 알림
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatusChange('accepted')}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckSquare className="w-6 h-6" />}
                합격으로 변경 + 알림
              </button>

              <button
                type="button"
                onClick={() => handleBulkStatusChange('rejected')}
                disabled={sending}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold transition-all shadow-lg disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <X className="w-6 h-6" />}
                불합격으로 변경 + 알림
              </button>

              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                disabled={sending}
                className="w-full px-6 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-bold transition-all disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}