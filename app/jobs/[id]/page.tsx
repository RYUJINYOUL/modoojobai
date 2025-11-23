"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  Clock, 
  Calendar,
  Building2,
  GraduationCap,
  Users,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Loader2,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface JobDetail {
  id: string;
  title: string;
  company: string;
  companyInfo?: {
    name: string;
    description: string;
    size?: string;
    industry?: string;
    website?: string;
  };
  location: {
    address: string;
    detail?: string;
  };
  region?: string;
  subRegion?: string;
  salary: {
    type: string;
    amount: string;
    negotiable: boolean;
  };
  recruitTypes: string[];
  jobType: string;
  education: string;
  deadline: {
    type: string;
    endDate?: string;
  };
  requirements: string;
  responsibilities: string;
  benefits?: string;
  welfare?: string;
  preferredQualifications?: string;
  selectedJobs: string[];
  selectedSpecialties: string[];
  positionLevels: string[];
  positionRoles: string[];
  workingHours?: {
    type: string;
    hours?: string;
  };
  applicationMethod: {
    type: string;
    email?: string;
    phone?: string;
    url?: string;
  };
  applicationSteps: string[];
  submissionDocuments: string;
  notice?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  isClosed: boolean;
  contactPerson?: {
    name: string;
    email: string;
    phone: string;
  };
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<{
    hasApplied: boolean;
    status?: string;
    applicationId?: string;
  }>({ hasApplied: false });
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  // 채용공고 데이터 가져오기
  useEffect(() => {
    const fetchJobDetail = async () => {
      try {
        setLoading(true);
        const jobRef = doc(db, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          setError('채용공고를 찾을 수 없습니다.');
          return;
        }

        const jobData = { id: jobSnap.id, ...jobSnap.data() } as JobDetail;
        
        // 마감되었거나 비공개 상태 체크
        if (jobData.isClosed || jobData.status !== 'published') {
          setError('이 채용공고는 현재 확인할 수 없습니다.');
          return;
        }

        setJob(jobData);
        
        // 좋아요 상태 및 지원 상태 확인
        if (uid) {
          const userRef = doc(db, 'users', uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const wishList = userSnap.data().wishList || [];
            setIsLiked(wishList.some((item: any) => item.id === `firebase_${jobId}`));
          }

          // 지원 상태 확인
          const applicationsRef = collection(db, 'applications');
          const applicationQuery = query(
            applicationsRef,
            where('userId', '==', uid),
            where('jobId', '==', jobId)
          );
          const applicationSnap = await getDocs(applicationQuery);
          
          if (!applicationSnap.empty) {
            const applicationDoc = applicationSnap.docs[0];
            const applicationData = applicationDoc.data();
            setApplicationStatus({
              hasApplied: true,
              status: applicationData.status,
              applicationId: applicationDoc.id
            });
          }
        }
      } catch (err) {
        console.error('채용공고 로드 실패:', err);
        setError('채용공고를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchJobDetail();
  }, [jobId, uid]);


  
// app/jobs/[id]/page.tsx에서 toggleLike 함수 수정
const toggleLike = async () => {
  if (!uid) {
    alert('로그인이 필요합니다.');
    router.push('/login');
    return;
  }

  if (!job) return;

  try {
    const userRef = doc(db, 'users', uid);
    
    // 🔥 undefined 방지 - 모든 필드 체크
    const jobToSave = {
      id: `firebase_${jobId}`,
      title: job.title || '',
      company: job.company || '',
      location: job.location?.address || '',  // ← 수정
      deadline: job.deadline?.endDate || '상시채용',  // ← 수정
      url: `/jobs/${jobId}`,
    };

    if (isLiked) {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const wishList = userSnap.data().wishList || [];
        const jobToRemove = wishList.find((item: any) => item.id === `firebase_${jobId}`);
        if (jobToRemove) {
          await updateDoc(userRef, {
            wishList: arrayRemove(jobToRemove)
          });
        }
      }
      setIsLiked(false);
    } else {
      await updateDoc(userRef, {
        wishList: arrayUnion(jobToSave)
      });
      setIsLiked(true);
    }
  } catch (error) {
    console.error('좋아요 저장 실패:', error);
    alert('좋아요 저장에 실패했습니다.');
  }
};

  // 공유하기
  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: job?.title || '채용공고',
          text: `${job?.company} - ${job?.title}`,
          url: shareUrl,
        });
      } catch (err) {
        console.log('공유 취소됨');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('링크가 클립보드에 복사되었습니다!');
    }
  };

  // 지원하기 또는 지원서 보기
  const handleApply = () => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    if (applicationStatus.hasApplied && applicationStatus.applicationId) {
      // 이미 지원한 경우 지원서 상세 페이지로 이동
      router.push(`/applications/${applicationStatus.applicationId}`);
    } else {
      // 지원서 제출 페이지로 이동
      router.push(`/applications/submit?jobId=${jobId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl font-semibold">채용공고를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">채용공고를 찾을 수 없습니다</h2>
            <p className="text-gray-600 text-lg mb-8">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all shadow-lg"
            >
              채용공고 목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const salaryText = job.salary.amount 
    ? `${job.salary.type} ${job.salary.amount}만원${job.salary.negotiable ? ' (협의가능)' : ''}`
    : '회사내규';

  const deadlineText = job.deadline.type === '날짜지정' && job.deadline.endDate
    ? job.deadline.endDate
    : '상시채용';

  // 지원 상태 정보
  const getStatusInfo = () => {
    if (!applicationStatus.hasApplied) {
      return { label: '지원 가능', color: 'blue', buttonText: '지원하기' };
    }
    
    const statusLabels: { [key: string]: { label: string; color: string } } = {
      submitted: { label: '지원 완료', color: 'blue' },
      reviewed: { label: '검토 중', color: 'yellow' },
      interview: { label: '면접 대기', color: 'purple' },
      accepted: { label: '합격', color: 'green' },
      rejected: { label: '불합격', color: 'red' }
    };
    
    const statusInfo = statusLabels[applicationStatus.status || 'submitted'] || statusLabels.submitted;
    return { 
      ...statusInfo, 
      buttonText: '지원서 확인하기'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 헤더 - 뒤로가기 */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition font-semibold text-lg"
          >
            <ArrowLeft className="w-6 h-6" />
            뒤로가기
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
          
          {/* 헤더 섹션 */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-10">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <span className="px-6 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                  <span className="text-2xl">🔥</span>
                  자사 채용
                </span>
                {job.positionLevels.map((level) => (
                  <span key={level} className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold">
                    {level}
                  </span>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={toggleLike}
                  className={`p-4 rounded-2xl transition-all shadow-lg hover:scale-105 ${
                    isLiked
                      ? 'bg-pink-500 text-white'
                      : 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30'
                  }`}
                  title={isLiked ? '저장됨' : '저장하기'}
                >
                  <Heart className={`w-6 h-6 ${isLiked ? 'fill-white' : ''}`} />
                </button>
                
                <button
                  onClick={handleShare}
                  className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl hover:bg-white/30 transition-all shadow-lg hover:scale-105"
                  title="공유하기"
                >
                  <Share2 className="w-6 h-6" />
                </button>
              </div>
            </div>

            <h1 className="text-5xl font-extrabold mb-6 leading-tight">
              {job.title}
            </h1>

            <div className="flex items-center gap-6 text-xl">
              <div className="flex items-center gap-3">
                <Building2 className="w-7 h-7" />
                <span className="font-bold">{job.company}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-7 h-7" />
                <span>{job.location.address} {job.location.detail}</span>
              </div>
            </div>
          </div>

          {/* 주요 정보 카드 */}
          <div className="p-10 border-b-2 border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                  <span className="text-sm text-gray-600 font-semibold">급여</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{salaryText}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-6 h-6 text-purple-600" />
                  <span className="text-sm text-gray-600 font-semibold">고용형태</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{job.recruitTypes.join(', ')}</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
                <div className="flex items-center gap-3 mb-2">
                  <GraduationCap className="w-6 h-6 text-green-600" />
                  <span className="text-sm text-gray-600 font-semibold">학력</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{job.education}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-6 h-6 text-orange-600" />
                  <span className="text-sm text-gray-600 font-semibold">경력</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{job.jobType}</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {/* 지원 상태 표시 */}
              {applicationStatus.hasApplied && (
                <div className={`p-6 rounded-2xl border-2 ${
                  statusInfo.color === 'green' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
                  statusInfo.color === 'yellow' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200' :
                  statusInfo.color === 'purple' ? 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200' :
                  statusInfo.color === 'red' ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' :
                  'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`w-7 h-7 ${
                      statusInfo.color === 'green' ? 'text-green-600' :
                      statusInfo.color === 'yellow' ? 'text-yellow-600' :
                      statusInfo.color === 'purple' ? 'text-purple-600' :
                      statusInfo.color === 'red' ? 'text-red-600' :
                      'text-blue-600'
                    }`} />
                    <div>
                      <p className="text-sm text-gray-600 font-semibold">지원 상태</p>
                      <p className={`text-xl font-bold ${
                        statusInfo.color === 'green' ? 'text-green-900' :
                        statusInfo.color === 'yellow' ? 'text-yellow-900' :
                        statusInfo.color === 'purple' ? 'text-purple-900' :
                        statusInfo.color === 'red' ? 'text-red-900' :
                        'text-blue-900'
                      }`}>{statusInfo.label}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 마감일과 지원 버튼 */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl border-2 border-red-200">
                <div className="flex items-center gap-3">
                  <Calendar className="w-7 h-7 text-red-600" />
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">마감일</p>
                    <p className="text-xl font-bold text-gray-900">{deadlineText}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleApply}
                  disabled={applyLoading}
                  className={`px-10 py-4 rounded-2xl font-bold text-xl shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 ${
                    applicationStatus.hasApplied 
                      ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                      : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700'
                  }`}
                >
                  {applyLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      {statusInfo.buttonText}
                      <ExternalLink className="w-6 h-6" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="p-10 space-y-10">
            
            {/* 주요업무 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle2 className="w-8 h-8 text-indigo-600" />
                <h2 className="text-3xl font-bold text-gray-900">주요업무</h2>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 border-2 border-indigo-200">
                <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                  {job.responsibilities}
                </p>
              </div>
            </section>

            {/* 자격요건 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-8 h-8 text-blue-600" />
                <h2 className="text-3xl font-bold text-gray-900">자격요건</h2>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border-2 border-blue-200">
                <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                  {job.requirements}
                </p>
              </div>
            </section>

            {/* 우대사항 */}
            {job.preferredQualifications && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Users className="w-8 h-8 text-green-600" />
                  <h2 className="text-3xl font-bold text-gray-900">우대사항</h2>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-200">
                  <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                    {job.preferredQualifications}
                  </p>
                </div>
              </section>
            )}

            {/* 복리후생 */}
            {(job.benefits || job.welfare) && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">🎁</span>
                  <h2 className="text-3xl font-bold text-gray-900">복리후생</h2>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-8 border-2 border-yellow-200">
                  {job.benefits && (
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-3">혜택</h3>
                      <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                        {job.benefits}
                      </p>
                    </div>
                  )}
                  {job.welfare && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">복지</h3>
                      <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
                        {job.welfare}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 지원 방법 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <Mail className="w-8 h-8 text-purple-600" />
                <h2 className="text-3xl font-bold text-gray-900">지원 방법</h2>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-200">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-2">지원 방식</p>
                    <p className="text-lg font-bold text-gray-900">{job.applicationMethod.type}</p>
                  </div>
                  
                  {job.applicationMethod.email && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-2">이메일</p>
                      <p className="text-lg text-indigo-600 font-semibold">{job.applicationMethod.email}</p>
                    </div>
                  )}
                  
                  {job.applicationMethod.phone && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-2">연락처</p>
                      <p className="text-lg text-indigo-600 font-semibold">{job.applicationMethod.phone}</p>
                    </div>
                  )}

                  {job.applicationSteps.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm text-gray-600 font-semibold mb-3">전형 절차</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {job.applicationSteps.map((step, idx) => (
                          <React.Fragment key={idx}>
                            <span className="px-4 py-2 bg-white rounded-xl font-semibold text-gray-900 shadow-md border-2 border-purple-200">
                              {step}
                            </span>
                            {idx < job.applicationSteps.length - 1 && (
                              <span className="text-2xl text-purple-400">→</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.submissionDocuments && (
                    <div className="mt-6">
                      <p className="text-sm text-gray-600 font-semibold mb-2">제출 서류</p>
                      <p className="text-lg text-gray-900">{job.submissionDocuments}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 기술 스택 & 직무 */}
            {(job.selectedJobs.length > 0 || job.selectedSpecialties.length > 0) && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl">💻</span>
                  <h2 className="text-3xl font-bold text-gray-900">기술 & 직무</h2>
                </div>
                <div className="space-y-4">
                  {job.selectedJobs.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-3">직무 분야</p>
                      <div className="flex flex-wrap gap-2">
                        {job.selectedJobs.map((job) => (
                          <span key={job} className="px-4 py-2 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-xl font-semibold shadow-sm">
                            {job}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {job.selectedSpecialties.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 font-semibold mb-3">전문 기술</p>
                      <div className="flex flex-wrap gap-2">
                        {job.selectedSpecialties.map((spec) => (
                          <span key={spec} className="px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 rounded-xl font-semibold shadow-sm">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 유의사항 */}
            {job.notice && (
              <section>
                <div className="bg-amber-50 rounded-2xl p-8 border-2 border-amber-300">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-bold text-amber-900 mb-3">유의사항</h3>
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {job.notice}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* 하단 액션 */}
          <div className="p-10 bg-gradient-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200">
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => router.back()}
                className="px-8 py-4 bg-white text-gray-700 rounded-2xl hover:bg-gray-100 font-bold text-lg transition-all shadow-lg border-2 border-gray-300"
              >
                뒤로가기
              </button>
              
              <button
                onClick={handleApply}
                disabled={applyLoading}
                className={`px-12 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 ${
                  applicationStatus.hasApplied 
                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700'
                }`}
              >
                {applyLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  <>
                    {applicationStatus.hasApplied ? '지원서 확인하기' : '지금 지원하기'}
                    <ExternalLink className="w-6 h-6" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 등록 정보 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            등록일: {new Date(job.createdAt).toLocaleDateString('ko-KR')} | 
            수정일: {new Date(job.updatedAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>
    </div>
  );
}