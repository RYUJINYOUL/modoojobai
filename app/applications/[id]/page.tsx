"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  ArrowLeft, 
  Award,
  Calendar,
  User, 
  Mail, 
  Phone, 
  Heart ,
  Briefcase,
  Link as LinkIcon,
  Globe,
  Loader2,
  Camera,
  AlertCircle,
  GraduationCap,
  Settings,
  Star,
  BookOpen
} from 'lucide-react';

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
    address?: string;
    profileImageUrl: string | null;
    educations: Array<{
      school: string;
      major: string;
      degree: string;
      subDegree?: string;
      entryYear: string;
      graduationYear: string;
      status: string;
    }>;
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
    careers: any[];
    workPreferences: {
      workType: string[];
      workPeriod: string;
      workDays: string[];
      workLocation: { regions: string[] };
      selectedJobs: string[];
      selectedSpecialties: string[];
    };
    languages: any[];
    certificates: any[];
    computerSkills: any[];
    specialties: any[];
    photoAlbum: any[];
    employmentPreferences: any;
  };
  status: 'submitted' | 'reviewed' | 'interview' | 'accepted' | 'rejected';
  isChecked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type StatusKey = 'submitted' | 'reviewed' | 'accepted' | 'rejected';
type StatusInfo = {
  label: string;
  color: 'blue' | 'yellow' | 'green' | 'red';
  emoji: string;
};

const STATUS_INFO: Record<StatusKey, StatusInfo> = {
  submitted: { label: '제출 완료', color: 'blue', emoji: '📝' },
  reviewed: { label: '검토 중', color: 'yellow', emoji: '👀' },
  accepted: { label: '합격', color: 'green', emoji: '🎉' },
  rejected: { label: '불합격', color: 'red', emoji: '😢' },
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();

  
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    const fetchApplication = async () => {
      try {
        setLoading(true);
        console.log(params.id);
        const appRef = doc(db, 'applications', params.id as string);
        const appSnap = await getDoc(appRef);
        console.log(appSnap.exists());

        const appData = { id: appSnap.id, ...appSnap.data() } as Application;

        // 1. 본인 지원서인지 확인 (개인 사용자)
        if (appData.userId === uid) {
          setApplication(appData);
          return; // 본인이면 바로 로드하고 종료
        }

        // 2. 채용공고 정보 가져오기 (회사/담당자 확인을 위함)
        // TODO: 'jobs' 컬렉션에서 jobData를 가져오는 로직이 필요합니다.
        const jobRef = doc(db, 'jobs', appData.jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          // 지원서는 있지만, 연결된 채용공고가 없다면 오류 처리
          setError('연결된 채용공고를 찾을 수 없습니다.');
          return;
        }

        const jobData = jobSnap.data();
        const recruiterId = jobData?.userId; // 채용공고 작성자 (담당자) UID

        // 3. 채용 담당자인지 확인 (기업 사용자)
        if (recruiterId === uid) {
          setApplication(appData);
          return; // 채용 담당자이면 로드하고 종료
        }

        // 4. 위의 어떤 조건에도 해당되지 않으면 접근 차단
        setError('본인의 지원서 또는 해당 공고의 담당자만 확인할 수 있습니다.');
        return;


      } catch (err) {
        console.error('지원서 로드 실패:', err);
        setError('지원서를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplication();
  }, [ uid, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl font-semibold">지원서 확인 중...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-20">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">지원서를 찾을 수 없습니다</h2>
            <p className="text-gray-600 text-lg mb-8">{error}</p>
            <button
              onClick={() => router.push('/profile')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all shadow-lg"
            >
              프로필로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[application.status as StatusKey] || STATUS_INFO.submitted;
  const statusColorClasses = {
    blue: 'from-blue-500 to-blue-600',
    yellow: 'from-yellow-500 to-yellow-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition font-semibold text-lg"
          >
            <ArrowLeft className="w-6 h-6" />
            뒤로가기
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/jobs/${application.jobId}`)}
              className="px-6 py-3 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition font-semibold flex items-center gap-2"
            >
              <Briefcase className="w-5 h-5" />
              채용공고 보기
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="px-6 py-3 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition font-semibold"
            >
              프로필로 돌아가기
            </button>
          </div>
        </div>

        {/* 상태 헤더 */}
        <div className={`bg-gradient-to-r ${statusColorClasses[statusInfo.color]} text-white rounded-3xl p-10 mb-8 shadow-2xl`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{statusInfo.emoji}</span>
              <div>
                <p className="text-sm opacity-90 mb-1">지원 상태</p>
                <p className="text-4xl font-extrabold">{statusInfo.label}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm opacity-90 mb-1">제출일</p>
              <p className="text-xl font-bold">
                {application.createdAt && application.createdAt.toDate ? application.createdAt.toDate().toLocaleDateString('ko-KR') : '-'}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/30">
            <h1 className="text-3xl font-bold mb-2">{application.jobTitle}</h1>
            <p className="text-xl opacity-90">{application.company}</p>
          </div>
        </div>

        {/* 지원자 정보 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-7 h-7 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">지원자 정보</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {/* 프로필 사진 */}
            {application.resume.profileImageUrl && (
              <div className="md:col-span-1">
                <img 
                  src={application.resume.profileImageUrl} 
                  alt="프로필" 
                  className="w-full aspect-[3/4] object-cover rounded-2xl border-2 border-gray-200 shadow-lg"
                />
              </div>
            )}

            <div className={`${application.resume.profileImageUrl ? 'md:col-span-3' : 'md:col-span-4'} grid md:grid-cols-2 gap-4`}>
              <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                <User className="w-6 h-6 text-indigo-600" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">이름</p>
                  <p className="font-bold text-gray-900">{application.resume.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <Mail className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">이메일</p>
                  <p className="font-bold text-gray-900">{application.resume.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                <Phone className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">연락처</p>
                  <p className="font-bold text-gray-900">{application.resume.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                <Calendar className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600 mb-1">생년월일</p>
                  <p className="font-bold text-gray-900">{application.resume.birthDate || '-'}</p>
                </div>
              </div>

              {application.resume.address && (
                <div className="md:col-span-2 p-4 bg-orange-50 rounded-xl">
                  <p className="text-sm text-gray-600 mb-1">주소</p>
                  <p className="font-bold text-gray-900">{application.resume.address}</p>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 자기소개서 */}
        {application.resume.selfIntroduction && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">자기소개서</h2>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{application.resume.selfIntroduction}</p>
            </div>
          </div>
        )}

        {/* 학력 */}
        {application.resume.educations && application.resume.educations.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">학력사항</h2>
            </div>

            <div className="space-y-4">
              {application.resume.educations.map((edu, index) => (
                <div key={index} className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {edu.degree} {edu.subDegree && `(${edu.subDegree})`} - {edu.school}
                      </h3>
                      <p className="text-lg text-gray-700">{edu.major}</p>
                    </div>
                    <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                      {edu.status}
                    </span>
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
        {application.resume.careers && application.resume.careers.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">경력사항</h2>
            </div>
            <div className="space-y-4">
              {application.resume.careers.map((career, index) => (
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
        {application.resume.workPreferences && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Heart className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">희망근무조건</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex"><strong className="w-28">근무기간:</strong> <span className="text-gray-700">{application.resume.workPreferences.workPeriod}</span></div>
              <div className="flex"><strong className="w-28">근무요일:</strong> <span className="text-gray-700">{application.resume.workPreferences.workDays?.join(', ')}</span></div>
              <div className="flex"><strong className="w-28">근무형태:</strong> <span className="text-gray-700">{application.resume.workPreferences.workType?.join(', ')}</span></div>
              <div className="flex"><strong className="w-28">희망근무지:</strong> <span className="text-gray-700">{application.resume.workPreferences.workLocation?.regions?.join(', ')}</span></div>
              <div className="md:col-span-2 flex"><strong className="w-28">희망업직종:</strong> <span className="text-gray-700">{(application.resume.workPreferences.selectedJobs || []).concat(application.resume.workPreferences.selectedSpecialties || []).join(', ')}</span></div>
            </div>
          </div>
        )}

        {/* 외국어 능력 */}
        {application.resume.languages && application.resume.languages.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Globe className="w-7 h-7 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">외국어 능력</h2>
            </div>
            <div className="space-y-3">
              {application.resume.languages.map((lang, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <p className="font-bold text-gray-900">{lang.language} - <span className="font-medium text-orange-700">{lang.level}</span></p>
                  {lang.testName && <p className="text-sm text-gray-600">{lang.testName}: {lang.score} ({lang.date})</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 자격증 */}
        {application.resume.certificates && application.resume.certificates.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Award className="w-7 h-7 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">자격증</h2>
            </div>
            <div className="space-y-3">
              {application.resume.certificates.map((cert, index) => (
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
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {application.resume.computerSkills && application.resume.computerSkills.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                  <Settings className="w-7 h-7 text-sky-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">컴퓨터 능력</h2>
              </div>
              <div className="space-y-2">
                {application.resume.computerSkills.map((skill, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="font-semibold">{skill.program}</span>
                    <span className="px-3 py-1 bg-sky-200 text-sky-800 text-xs font-bold rounded-full">{skill.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.resume.specialties && application.resume.specialties.length > 0 && (
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                  <Star className="w-7 h-7 text-pink-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">특기사항</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {application.resume.specialties.map((spec, index) => (
                  <span key={index} className="px-3 py-2 bg-pink-100 text-pink-800 rounded-lg font-medium text-sm">{spec.title}</span>
                ))}
              </div>
            </div>
          )}
        </div>

         {/* 포트폴리오 */}
        {application.resume.portfolios && application.resume.portfolios.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                <LinkIcon className="w-7 h-7 text-cyan-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
            </div>
            <div className="space-y-3">
              {application.resume.portfolios.map((portfolio, index) => (
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
        {application.resume.employmentPreferences && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <User className="w-7 h-7 text-teal-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">취업우대사항</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
              <div className="flex"><strong className="w-28">병역:</strong> <span className="text-gray-700">{application.resume.employmentPreferences.military}</span></div>
              <div className="flex"><strong className="w-28">장애여부:</strong> <span className="text-gray-700">{application.resume.employmentPreferences.disability}</span></div>
              <div className="flex"><strong className="w-28">국가보훈:</strong> <span className="text-gray-700">{application.resume.employmentPreferences.veteran}</span></div>
              <div className="flex"><strong className="w-28">고용지원금:</strong> <span className="text-gray-700">{application.resume.employmentPreferences.subsidy}</span></div>
            </div>
          </div>
        )}

        {/* 포토앨범 */}
        {application.resume.photoAlbum && application.resume.photoAlbum.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Camera className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">포토앨범</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {application.resume.photoAlbum.map((photo: any) => (
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

        {/* 하단 정보 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mt-8 border border-gray-200 text-center">
          <p className="text-gray-600 mb-4">위의 모든 기재사항은 사실과 다름없음을 확인합니다.</p>
          <p className="font-semibold text-gray-800">
            작성일: {application.createdAt?.toDate?.().toLocaleDateString('ko-KR') || '-'}
          </p>
          <p className="font-semibold text-gray-800 mt-1">
            작성자: {application.resume.name}
          </p>
        </div>
      </div>
    </div>
  );
}