"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import {
  ArrowLeft,
  CheckCircle,
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Loader2,
  AlertCircle,
  FileText,
  Send,
  Eye,
  Globe,
  Award,
  Star,
  Heart,
  Camera,
  Link as LinkIcon,
  Calendar,
  Settings,
  BookOpen
} from 'lucide-react';

function ApplicationSubmitContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  // 채용공고 정보
  const [job, setJob] = useState<any>(null);
  const [jobLoading, setJobLoading] = useState(true);

  // 이력서 정보 (resumes/{uid} 컬렉션에서)
  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedResume, setSelectedResume] = useState<any>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [resumeError, setResumeError] = useState('');

  // 제출 상태
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 로그인 체크
  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
    }
  }, [uid, router]);

  // 채용공고 정보 가져오기
  useEffect(() => {
    if (!jobId) {
      setError('채용공고 ID가 없습니다.');
      setJobLoading(false);
      return;
    }

    const fetchJob = async () => {
      try {
        const jobRef = doc(db, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          setError('채용공고를 찾을 수 없습니다.');
          return;
        }

        const jobData = { id: jobSnap.id, ...jobSnap.data() } as {
          id: string; isClosed: boolean; status: string; [key: string]: any;
        };

        if (jobData.isClosed || jobData.status !== 'published') {
          setError('마감되었거나 유효하지 않은 채용공고입니다.');
          return;
        }

        setJob(jobData);
      } catch (err) {
        console.error('채용공고 로드 실패:', err);
        setError('채용공고를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setJobLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  // 이력서 정보 가져오기 (resumes 컬렉션에서)
  useEffect(() => {
    if (!uid) return;

    const fetchResumes = async () => {
      try {
        const resumesRef = collection(db, 'resumes');
        // 'updatedAt'이 서버 타임스탬프이므로, 최신순으로 가져옵니다.
        const q = query(resumesRef, where('userId', '==', uid), orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          setResumeError('저장된 이력서가 없습니다. 먼저 이력서를 작성해주세요.');
          return;
        }

        const userResumes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // 클라이언트 렌더링 시점에 toDate()를 사용하여 날짜 객체로 변환
          updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : new Date(),
        }));

        setResumes(userResumes);

        // 가장 최근에 업데이트된 이력서를 기본으로 선택
        if (userResumes.length > 0) {
          setSelectedResume(userResumes[0]);
        }
      } catch (err) {
        console.error('이력서 로드 실패:', err);
        setResumeError('이력서를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setResumeLoading(false);
      }
    };
    fetchResumes();
  }, [uid]);

  // 지원서 제출
  const handleSubmit = async () => {
    if (!uid || !jobId || !job || !selectedResume) {
      alert('제출에 필요한 정보가 부족합니다. 이력서를 선택해주세요.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 중복 지원 체크
      const applicationsRef = collection(db, 'applications');
      const q = query(
        applicationsRef,
        where('userId', '==', uid),
        where('jobId', '==', jobId)
      );
      const existingApps = await getDocs(q);

      if (!existingApps.empty) {
        alert('⚠️ 이미 지원한 채용공고입니다.');
        setSubmitting(false);
        return;
      }

      // 지원서 데이터 생성 (이력서 전체 포함)
      const applicationData = {
        // 사용자 정보
        userId: uid,

        // 채용공고 정보
        jobId: jobId,
        jobTitle: job.title || '제목 없음',
        company: job.company || '회사 정보 없음',

        // 이력서 정보 (resumes/{uid}에서 가져온 전체 데이터)
        // 불필요한 필드는 제외하고, 필요한 데이터만 복사하거나,
        // 전체를 복사하되 명시적으로 필드를 재정의하여 FireStore 데이터 구조 안정화
        resume: {
          ...selectedResume, // 이력서 전체 데이터 포함
          // 인적사항 필수 필드 재정의 (안정성)
          name: selectedResume.name || '',
          email: selectedResume.email || '',
          phone: selectedResume.phone || '',
        },

        // 지원 상태
        status: 'submitted', // submitted | reviewed | interview | accepted | rejected

        // 담당자 확인 여부
        isChecked: false,
        checkedAt: null,

        // 타임스탬프
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Firestore에 저장
      const docRef = await addDoc(applicationsRef, applicationData);

      alert('✅ 지원이 완료되었습니다!');
      router.push(`/applications/${docRef.id}`);

    } catch (err) {
      console.error('지원서 제출 실패:', err);
      setError('지원서 제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 로딩 상태
  if (jobLoading || resumeLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-12 bg-white rounded-3xl shadow-xl">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <p className="text-gray-600 text-xl font-semibold">
            {jobLoading ? '채용공고 정보 확인 중...' : '사용자 이력서 불러오는 중...'}
          </p>
        </div>
      </div>
    );
  }

  // 에러 또는 공고 없음 상태
  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-24">
          <div className="bg-white rounded-3xl shadow-2xl p-16 text-center border-t-4 border-red-500">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-8" />
            <h2 className="text-4xl font-bold text-gray-900 mb-6">지원할 수 없습니다</h2>
            <p className="text-gray-600 text-lg mb-10 font-medium">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-10 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 font-bold text-xl transition-all shadow-lg"
            >
              채용공고 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 이력서 없음 상태
  if (resumeError || resumes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-24">
          <div className="bg-white rounded-3xl shadow-2xl p-16 text-center border-t-4 border-blue-500">
            <FileText className="w-20 h-20 text-blue-500 mx-auto mb-8" />
            <h2 className="text-4xl font-bold text-gray-900 mb-6">이력서가 없습니다</h2>
            <p className="text-gray-600 text-lg mb-10 font-medium">{resumeError}</p>
            <div className="flex gap-6 justify-center">
              <button
                onClick={() => router.push('/profile/resume/edit')}
                className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold text-xl transition-all shadow-lg"
              >
                이력서 작성/수정하기
              </button>
              <button
                onClick={() => router.back()}
                className="px-10 py-4 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-bold text-xl transition-all"
              >
                뒤로가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 최종 제출 페이지
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* 뒤로가기 버튼 */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition font-medium text-lg p-2 rounded-lg hover:bg-indigo-50"
          >
            <ArrowLeft className="w-5 h-5" />
            이전 페이지로 돌아가기
          </button>
        </div>

        {/* 채용공고 정보 헤더 */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white rounded-3xl p-10 mb-12 shadow-2xl shadow-indigo-300/50">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-9 h-9 text-blue-300" />
            <span className="text-2xl font-semibold">지원서 제출 최종 확인</span>
          </div>
          <h1 className="text-5xl font-extrabold mb-3 leading-tight">{job.title}</h1>
          <p className="text-2xl font-light opacity-90">{job.company}</p>
        </div>
        <hr className="mb-12 border-gray-200" />

        {/* 이력서 미리보기 섹션 */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 mb-12 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <FileText className="w-7 h-7 text-indigo-600" />
              제출할 이력서 미리보기
            </h2>
            <button
              onClick={() => router.push('/profile/resume')} // 이력서 수정 경로를 명확하게 가정
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-lg px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition"
            >
              <Eye className="w-5 h-5" />
              이력서 수정 바로가기
            </button>
          </div>

          {/* 지원자 정보 */}
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <User className="w-7 h-7 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">지원자 정보</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {selectedResume.profileImageUrl && (
                <div className="md:col-span-1">
                  <img 
                    src={selectedResume.profileImageUrl} 
                    alt="프로필" 
                    className="w-full aspect-[3/4] object-cover rounded-2xl border-2 border-gray-200 shadow-lg"
                  />
                </div>
              )}
              <div className={`${selectedResume.profileImageUrl ? 'md:col-span-3' : 'md:col-span-4'} grid md:grid-cols-2 gap-4`}>
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                  <User className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-sm text-gray-600">이름</p>
                    <p className="font-bold text-gray-900">{selectedResume.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">이메일</p>
                    <p className="font-bold text-gray-900">{selectedResume.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                  <Phone className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">연락처</p>
                    <p className="font-bold text-gray-900">{selectedResume.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                  <Calendar className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">생년월일</p>
                    <p className="font-bold text-gray-900">{selectedResume.birthDate || '-'}</p>
                  </div>
                </div>
                {selectedResume.address && (
                  <div className="md:col-span-2 p-4 bg-orange-50 rounded-xl">
                    <p className="text-sm text-gray-600">주소</p>
                    <p className="font-bold text-gray-900">{selectedResume.address}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 자기소개서 */}
          {selectedResume.selfIntroduction && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">자기소개서</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedResume.selfIntroduction}
                </p>
              </div>
            </div>
          )}


          {/* 학력 */}
          {selectedResume.educations?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">학력사항</h2>
              </div>
              <div className="space-y-4">
                {selectedResume.educations.map((edu: any, index: number) => (
                  <div key={index} className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {edu.degree} {edu.subDegree && `(${edu.subDegree})`} - {edu.school}
                        </h3>
                        <p className="text-lg text-gray-700">{edu.major}</p>
                      </div>
                      <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">{edu.status}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      {edu.entryYear && edu.graduationYear && <span className="font-medium">📅 {edu.entryYear} ~ {edu.graduationYear}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 경력 */}
          {selectedResume.careers?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">경력사항</h2>
              </div>
              <div className="space-y-4">
                {selectedResume.careers.map((career: any, index: number) => (
                  <div key={index} className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{career.company}</h3>
                        <p className="text-lg text-gray-700">{career.position} / {career.department}</p>
                      </div>
                      <p className="text-sm text-gray-500 font-medium">{career.startDate} ~ {career.isCurrent ? '현재' : career.endDate}</p>
                    </div>
                    <p className="text-gray-600">{career.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 희망근무조건 */}
          {selectedResume.workPreferences && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Heart className="w-7 h-7 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">희망근무조건</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex"><strong className="w-28">근무기간:</strong> <span className="text-gray-700">{selectedResume.workPreferences.workPeriod}</span></div>
                <div className="flex"><strong className="w-28">근무요일:</strong> <span className="text-gray-700">{selectedResume.workPreferences.workDays?.join(', ')}</span></div>
                <div className="flex"><strong className="w-28">근무형태:</strong> <span className="text-gray-700">{selectedResume.workPreferences.workType?.join(', ')}</span></div>
                <div className="flex"><strong className="w-28">희망근무지:</strong> <span className="text-gray-700">{selectedResume.workPreferences.workLocation?.regions?.join(', ')}</span></div>
                <div className="md:col-span-2 flex"><strong className="w-28">희망업직종:</strong> <span className="text-gray-700">{(selectedResume.workPreferences.selectedJobs || []).concat(selectedResume.workPreferences.selectedSpecialties || []).join(', ')}</span></div>
              </div>
            </div>
          )}

          {/* 외국어 능력 */}
          {selectedResume.languages && selectedResume.languages.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-7 h-7 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">외국어 능력</h2>
              </div>
              <div className="space-y-3">
                {selectedResume.languages.map((lang: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <p className="font-bold text-gray-900">{lang.language} - <span className="font-medium text-orange-700">{lang.level}</span></p>
                    {lang.testName && <p className="text-sm text-gray-600">{lang.testName}: {lang.score} ({lang.date})</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 자격증 */}
          {selectedResume.certificates && selectedResume.certificates.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Award className="w-7 h-7 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">자격증</h2>
              </div>
              <div className="space-y-3">
                {selectedResume.certificates.map((cert: any, idx: number) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <p className="font-bold text-gray-900">{cert.name}</p>
                    <p className="text-sm text-gray-600">{cert.issuer} ({cert.date})</p>
                    {cert.score && <p className="text-sm text-gray-500">점수/등급: {cert.score}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 컴퓨터 활용능력 & 특기사항 */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {selectedResume.computerSkills && selectedResume.computerSkills.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                    <Settings className="w-7 h-7 text-sky-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">컴퓨터 능력</h2>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 space-y-2">
                  {selectedResume.computerSkills.map((skill: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="font-semibold">{skill.program}</span>
                      <span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">{skill.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedResume.specialties && selectedResume.specialties.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                    <Star className="w-7 h-7 text-pink-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">특기사항</h2>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 flex flex-wrap gap-2">
                  {selectedResume.specialties.map((spec: any, idx: number) => (
                    <div key={idx} className="px-3 py-1.5 bg-pink-100 text-pink-800 rounded-lg font-medium text-sm">
                      {spec.title}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

               {/* 포트폴리오 */}
          {selectedResume.portfolios && selectedResume.portfolios.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                  <LinkIcon className="w-7 h-7 text-cyan-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
              </div>
              <div className="space-y-3">
                {selectedResume.portfolios.map((portfolio: any, index: number) => (
                  <a
                    key={portfolio.id || index}
                    href={portfolio.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:bg-cyan-50 hover:border-cyan-300 transition-all"
                  >
                    <LinkIcon className="w-5 h-5 text-cyan-600" />
                    <p className="font-bold text-gray-900">{portfolio.name || portfolio.url}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 포트폴리오 */}
          {selectedResume.portfolios && selectedResume.portfolios.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                  <LinkIcon className="w-7 h-7 text-cyan-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
              </div>
              <div className="space-y-3">
                {selectedResume.portfolios.map((portfolio: any, index: number) => (
                  <a
                    key={portfolio.id || index}
                    href={portfolio.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:bg-cyan-50 hover:border-cyan-300 transition-all"
                  >
                    <LinkIcon className="w-5 h-5 text-cyan-600" />
                    <p className="font-bold text-gray-900">{portfolio.name || portfolio.url}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
          

          {/* 취업우대사항 */}
          {selectedResume.employmentPreferences && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">취업우대사항</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex"><strong className="w-28">병역:</strong> <span className="text-gray-700">{selectedResume.employmentPreferences.military}</span></div>
                <div className="flex"><strong className="w-28">장애여부:</strong> <span className="text-gray-700">{selectedResume.employmentPreferences.disability}</span></div>
                <div className="flex"><strong className="w-28">국가보훈:</strong> <span className="text-gray-700">{selectedResume.employmentPreferences.veteran}</span></div>
                <div className="flex"><strong className="w-28">고용지원금:</strong> <span className="text-gray-700">{selectedResume.employmentPreferences.subsidy}</span></div>
              </div>
            </div>
          )}

          {/* 포토앨범 */}
          {selectedResume.photoAlbum?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Camera className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">포토앨범</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {selectedResume.photoAlbum.slice(0, 5).map((photo: any) => (
                  <div key={photo.id} className="aspect-square relative overflow-hidden rounded-xl shadow-lg border-2 border-gray-100">
                    <img
                      src={photo.url}
                      alt="포토앨범 이미지"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
  
        {/* --- 이력서 미리보기 섹션 종료 --- */}
        
        {/* 제출 액션 영역 */}
        <div className="bg-white rounded-3xl shadow-2xl p-12 border border-gray-100 bottom-0 z-10">

          {/* 이력서 선택 드롭다운 */}
          <div className="mb-8 p-6 bg-indigo-50/70 rounded-2xl border-2 border-indigo-300 shadow-inner">
            <label htmlFor="resume-select" className="block text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <FileText className="w-6 h-6 text-indigo-600" /> 최종 제출 이력서 선택
            </label>
            <select
              id="resume-select"
              value={selectedResume?.id || ''}
              onChange={(e) => {
                const newSelectedResume = resumes.find(r => r.id === e.target.value);
                setSelectedResume(newSelectedResume);
              }}
              className="w-full px-5 py-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-600 text-lg font-medium bg-white shadow-md"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || '이름 없음'}의 이력서 (최종 수정: {r.updatedAt instanceof Date ? r.updatedAt.toLocaleDateString() : '날짜 정보 없음'})
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-600 mt-3 ml-1">
              제출할 이력서를 신중하게 선택해주세요. 현재 미리보기에 표시된 이력서가 선택된 이력서입니다.
            </p>
          </div>

          {/* 제출 전 주의사항 */}
          <div className="flex items-start gap-4 mb-8 p-6 bg-orange-50/70 rounded-2xl border-2 border-orange-300 shadow-inner">
            <AlertCircle className="w-7 h-7 text-orange-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-xl text-orange-900 mb-2">필수 확인 사항</h3>
              <ul className="text-base text-gray-700 space-y-1 ml-1 list-disc pl-5">
                <li>이력서의 모든 정보(**연락처, 경력, 학력 등**)가 **최신 정보**인지 확인했습니다.</li>
                <li>**제출된 지원서는 수정하거나 철회할 수 없으며**, 신중하게 제출해야 합니다.</li>
                <li>**중복 지원**은 불가능합니다. 이미 지원한 공고인지 확인했습니다.</li>
              </ul>
            </div>
          </div>

          {/* 최종 버튼 그룹 */}
          <div className="flex gap-6">
            <button
              onClick={() => router.back()}
              className="flex-1 px-10 py-4 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 font-bold text-xl transition-all shadow-md"
            >
              <ArrowLeft className="w-6 h-6 inline-block mr-2" /> 취소하고 뒤로가기
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedResume}
              className="flex-1 px-10 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 font-extrabold text-xl transition-all shadow-xl shadow-indigo-400/50 disabled:opacity-60 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  지원서 제출 중...
                </>
              ) : (
                <>
                  <Send className="w-7 h-7" />
                  최종 지원서 제출
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationSubmitPage() {
  return (
    // Suspense로 감싸서 useSearchParams를 사용하는 컴포넌트의 렌더링을 지연시킵니다.
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-12 bg-white rounded-3xl shadow-xl">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <p className="text-gray-600 text-xl font-semibold">페이지를 불러오는 중...</p>
        </div>
      </div>
    }>
      <ApplicationSubmitContent />
    </Suspense>
  );
}