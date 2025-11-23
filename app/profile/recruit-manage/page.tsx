"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  ArrowLeft, 
  Briefcase,
  Eye,
  Users,
  Calendar,
  MapPin,
  Building2,
  Loader2,
  AlertCircle,
  Settings,
  Plus
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  company: string;
  location: {
    address: string;
    detail: string;
  };
  status: string;
  isClosed: boolean;
  createdAt: any;
  createdBy: string;
}

export default function RecruitManagePage() {
  const router = useRouter();
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicationsCount, setApplicationsCount] = useState<{[key: string]: number}>({});

  // 로그인 체크
  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
    }
  }, [uid, router]);

  // 내가 등록한 채용공고 가져오기
  useEffect(() => {
    if (!uid) return;

    const fetchMyJobs = async () => {
      try {
        setLoading(true);
        
        // 내가 등록한 채용공고 조회
        const jobsRef = collection(db, 'jobs');
        const q = query(
          jobsRef,
          where('userId', '==', uid),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const myJobs: Job[] = [];
        
        snapshot.forEach((doc) => {
          myJobs.push({ id: doc.id, ...doc.data() } as Job);
        });

        setJobs(myJobs);

        // 각 채용공고별 지원자 수 조회
        const counts: {[key: string]: number} = {};
        for (const job of myJobs) {
          const applicationsRef = collection(db, 'applications');
          const appQuery = query(applicationsRef, where('jobId', '==', job.id));
          const appSnapshot = await getDocs(appQuery);
          counts[job.id] = appSnapshot.size;
        }
        setApplicationsCount(counts);

      } catch (error) {
        console.error('채용공고 목록 로드 실패:', error);
        alert('채용공고 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyJobs();
  }, [uid]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition font-semibold text-lg mb-6"
          >
            <ArrowLeft className="w-6 h-6" />
            프로필로 돌아가기
          </button>

          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-amber-600 rounded-2xl flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900">채용공고 관리</h1>
                  <p className="text-gray-600 text-lg">내가 등록한 채용공고와 지원자를 관리하세요</p>
                </div>
              </div>
              
              <button
                onClick={() => router.push('/profile/recruit')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                새 채용공고 등록
              </button>
            </div>
          </div>
        </div>

        {/* 채용공고 목록 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
          {jobs.length === 0 ? (
            <div className="p-20 text-center">
              <Briefcase className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">등록한 채용공고가 없습니다</h3>
              <p className="text-gray-600 text-lg mb-8">
                첫 번째 채용공고를 등록해보세요!
              </p>
              <button
                onClick={() => router.push('/profile/recruit')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all shadow-lg"
              >
                채용공고 등록하기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-7 h-7 text-indigo-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-2">
                                {job.title}
                              </h3>
                              <div className="flex items-center gap-4 text-gray-600 mb-2">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  <span className="font-semibold">{job.company}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{job.location?.address || '-'} {job.location?.detail || ''}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {job.isClosed ? (
                                <span className="px-4 py-2 bg-red-100 text-red-700 rounded-xl font-bold text-sm border-2 border-red-300">
                                  마감
                                </span>
                              ) : job.status === 'published' ? (
                                <span className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold text-sm border-2 border-green-300">
                                  모집중
                                </span>
                              ) : (
                                <span className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-xl font-bold text-sm border-2 border-yellow-300">
                                  임시저장
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                등록일: {job.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              <span>
                                지원자: {applicationsCount[job.id] || 0}명
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => router.push(`/jobs/${job.id}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors font-semibold"
                            >
                              <Eye className="w-4 h-4" />
                              공고 보기
                            </button>
                            
                            <button
                              onClick={() => router.push(`/applications/manage/${job.id}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors font-semibold"
                            >
                              <Users className="w-4 h-4" />
                              지원자 관리 ({applicationsCount[job.id] || 0})
                            </button>
                            
                            <button
                              onClick={() => router.push(`/profile/recruit?edit=${job.id}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                            >
                              <Settings className="w-4 h-4" />
                              수정
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
