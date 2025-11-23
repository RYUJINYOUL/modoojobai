"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Briefcase,
  GraduationCap,
  Loader2,
  AlertCircle,
  FileText,
  Globe,
  Award,
  Star,
  Link as LinkIcon,
  Heart,
  BookOpen,
  Camera,
  Calendar,
  Settings
} from 'lucide-react';

interface Resume {
  id: string;
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  address?: string;
  userId: string;
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
  updatedAt: Timestamp;
}

export default function ResumePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const resumeId = params.id as string;

  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;
  console.log(uid)

  // 💡 추가: currentUser에서 userType을 가져와 기업 회원 여부를 판단합니다.
  const isEnterprise = currentUser?.userType === 'enterprise';
  
  console.log(isEnterprise)
  
  // 이력서 데이터의 소유자 여부 확인
  const isOwner = resume?.userId === uid;
  
  // 💡 추가: 개인 사용자이면서 본인의 이력서가 아닌 경우 (블라인드 처리 대상)
  const shouldBePrivate = !isEnterprise && !isOwner; 
  // Enterprise가 아니면서 본인이 아닌 경우에만 Private 처리 (즉, Enterprise 회원만 남의 이력서를 상세히 볼 수 있음)

  // 이름, 이메일, 연락처, 생년월일, 주소를 가립니다.
  // 이력서 소유자(isOwner)거나 기업회원(isEnterprise)인 경우에만 실제 데이터를 보여줍니다.
  const displayName = shouldBePrivate ? '비공개' : resume?.name;
  const displayEmail = shouldBePrivate ? '비공개' : resume?.email;
  const displayPhone = shouldBePrivate ? '비공개' : resume?.phone;
  const displayBirthDate = shouldBePrivate ? '비공개' : (resume?.birthDate || '-');
  const displayAddress = shouldBePrivate ? '비공개' : resume?.address;

  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    if (!resumeId) {
      setError('이력서 ID가 없습니다.');
      setLoading(false);
      return;
    }

    const fetchResume = async () => {
      try {
        const resumeRef = doc(db, 'resumes', resumeId);
        const resumeSnap = await getDoc(resumeRef);

        if (!resumeSnap.exists()) {
          setError('이력서를 찾을 수 없습니다.');
          return;
        }

        const resumeData = { id: resumeSnap.id, ...resumeSnap.data() } as Resume;

        setResume(resumeData);
      } catch (err) {
        console.error('이력서 로드 실패:', err);
        setError('이력서를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchResume();
  }, [resumeId, uid, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-12 bg-white rounded-3xl shadow-xl">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-6" />
          <p className="text-gray-600 text-xl font-semibold">이력서 미리보기 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-24">
          <div className="bg-white rounded-3xl shadow-2xl p-16 text-center border-t-4 border-red-500">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-8" />
            <h2 className="text-4xl font-bold text-gray-900 mb-6">미리보기를 표시할 수 없습니다</h2>
            <p className="text-gray-600 text-lg mb-10 font-medium">{error}</p>
            <button
              onClick={() => router.push('/profile/resume')}
              className="px-10 py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl hover:from-red-700 hover:to-pink-700 font-bold text-xl transition-all shadow-lg"
            >
              이력서 관리로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition font-medium text-lg p-2 rounded-lg hover:bg-indigo-50"
          >
            <ArrowLeft className="w-5 h-5" />
            이전 페이지로 돌아가기
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-12 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
              <FileText className="w-7 h-7 text-indigo-600" />
              이력서 미리보기
            </h2>
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
              {!shouldBePrivate && resume.profileImageUrl && (
                <div className="md:col-span-1">
                  <img 
                    src={resume.profileImageUrl} 
                    alt="프로필" 
                    className="w-full aspect-[3/4] object-cover rounded-2xl border-2 border-gray-200 shadow-lg"
                  />
                </div>
              )}
              <div className={`${!shouldBePrivate && resume.profileImageUrl ? 'md:col-span-3' : 'md:col-span-4'} grid md:grid-cols-2 gap-4`}>
                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                  <User className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-sm text-gray-600">이름</p>
                    <p className="font-bold text-gray-900">{displayName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                  <Mail className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">이메일</p>
                    <p className="font-bold text-gray-900">{displayEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl">
                  <Phone className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-600">연락처</p>
                    <p className="font-bold text-gray-900">{displayPhone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
                  <Calendar className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-sm text-gray-600">생년월일</p>
                    <p className="font-bold text-gray-900">{displayBirthDate}</p>
                  </div>
                </div>
                {resume.address && (
                  <div className="md:col-span-2 p-4 bg-orange-50 rounded-xl">
                    <p className="text-sm text-gray-600">주소</p>
                    <p className="font-bold text-gray-900">{displayAddress}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 자기소개서 */}
          {!shouldBePrivate && resume.selfIntroduction && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-gray-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">자기소개서</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {resume.selfIntroduction}
                </p>
              </div>
            </div>
          )}


          {/* 학력 */}
          {!shouldBePrivate && resume.educations?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">학력사항</h2>
              </div>
              <div className="space-y-4">
                {resume.educations.map((edu: any, index: number) => (
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
          {!shouldBePrivate && resume.careers?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">경력사항</h2>
              </div>
              <div className="space-y-4">
                {resume.careers.map((career: any, index: number) => (
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
          {resume.workPreferences && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Heart className="w-7 h-7 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">희망근무조건</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex"><strong className="w-28">근무기간:</strong> <span className="text-gray-700">{resume.workPreferences.workPeriod}</span></div>
                <div className="flex"><strong className="w-28">근무요일:</strong> <span className="text-gray-700">{resume.workPreferences.workDays?.join(', ')}</span></div>
                <div className="flex"><strong className="w-28">근무형태:</strong> <span className="text-gray-700">{resume.workPreferences.workType?.join(', ')}</span></div>
                <div className="flex"><strong className="w-28">희망근무지:</strong> <span className="text-gray-700">{resume.workPreferences.workLocation?.regions?.join(', ')}</span></div>
                <div className="md:col-span-2 flex"><strong className="w-28">희망업직종:</strong> <span className="text-gray-700">{(resume.workPreferences.selectedJobs || []).concat(resume.workPreferences.selectedSpecialties || []).join(', ')}</span></div>
              </div>
            </div>
          )}

          {/* 외국어 능력 */}
          {!shouldBePrivate && resume.languages && resume.languages.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Globe className="w-7 h-7 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">외국어 능력</h2>
              </div>
              <div className="space-y-3">
                {resume.languages.map((lang, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <p className="font-bold text-gray-900">{lang.language} - <span className="font-medium text-orange-700">{lang.level}</span></p>
                    {lang.testName && <p className="text-sm text-gray-600">{lang.testName}: {lang.score} ({lang.date})</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 자격증 */}
          {!shouldBePrivate && resume.certificates && resume.certificates.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Award className="w-7 h-7 text-yellow-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">자격증</h2>
              </div>
              <div className="space-y-3">
                {resume.certificates.map((cert, index) => (
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
          {!shouldBePrivate && (
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center">
                    <Settings className="w-7 h-7 text-sky-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">컴퓨터 능력</h2>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 space-y-2">
                  {resume.computerSkills.map((skill, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="font-semibold">{skill.program}</span>
                      <span className="px-3 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full">{skill.level}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                    <Star className="w-7 h-7 text-pink-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">특기사항</h2>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 flex flex-wrap gap-2">
                  {resume.specialties.map((spec, idx) => (
                    <div key={idx} className="px-3 py-1.5 bg-pink-100 text-pink-800 rounded-lg font-medium text-sm">
                      {spec.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


           {/* 포트폴리오 */}
          {!shouldBePrivate && resume.portfolios && resume.portfolios.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                  <LinkIcon className="w-7 h-7 text-cyan-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">포트폴리오</h2>
              </div>
              <div className="space-y-3">
                {resume.portfolios.map((portfolio, index) => (
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
          {!shouldBePrivate && resume.employmentPreferences && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-teal-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">취업우대사항</h2>
              </div>
              <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200 grid md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex"><strong className="w-28">병역:</strong> <span className="text-gray-700">{resume.employmentPreferences.military}</span></div>
                <div className="flex"><strong className="w-28">장애여부:</strong> <span className="text-gray-700">{resume.employmentPreferences.disability}</span></div>
                <div className="flex"><strong className="w-28">국가보훈:</strong> <span className="text-gray-700">{resume.employmentPreferences.veteran}</span></div>
                <div className="flex"><strong className="w-28">고용지원금:</strong> <span className="text-gray-700">{resume.employmentPreferences.subsidy}</span></div>
              </div>
            </div>
          )}

          {/* 포토앨범 */}
          {!shouldBePrivate && resume.photoAlbum?.length > 0 && (
            <div className="mb-12">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Camera className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">포토앨범</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {resume.photoAlbum.map((photo: any) => (
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

          {/* 블라인드 처리된 경우 대체 메시지 렌더링 */}
          {shouldBePrivate && (
              <div className="p-12 bg-white rounded-3xl shadow-xl border border-gray-200 text-center mb-12">
                  <AlertCircle className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">상세 정보 비공개</h3>
                  <p className="text-gray-600">이력서 작성자 본인 또는 채용 담당 기업 회원만 상세 내용을 확인할 수 있습니다.</p>
              </div>
          )}

        </div>
      </div>
    </div>
  );
}