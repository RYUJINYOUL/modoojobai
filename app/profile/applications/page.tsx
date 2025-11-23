"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  ArrowLeft, 
  Calendar,
  Briefcase,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  MapPin,
  Send
} from 'lucide-react';

interface Application {
  id: string;
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: 'submitted' | 'reviewed' | 'interview' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type StatusKey = 'submitted' | 'reviewed' | 'interview' | 'accepted' | 'rejected';

const STATUS_INFO: Record<StatusKey, { label: string; color: string; icon: React.ElementType; bgColor: string }> = {
  submitted: { 
    label: '제출완료', 
    color: 'text-blue-700', 
    icon: Send, 
    bgColor: 'bg-blue-100 border-blue-300' 
  },
  reviewed: { 
    label: '검토중', 
    color: 'text-yellow-700', 
    icon: Clock, 
    bgColor: 'bg-yellow-100 border-yellow-300' 
  },
  interview: { 
    label: '면접대기', 
    color: 'text-purple-700', 
    icon: AlertCircle, 
    bgColor: 'bg-purple-100 border-purple-300' 
  },
  accepted: { 
    label: '합격', 
    color: 'text-green-700', 
    icon: CheckCircle2, 
    bgColor: 'bg-green-100 border-green-300' 
  },
  rejected: { 
    label: '불합격', 
    color: 'text-red-700', 
    icon: XCircle, 
    bgColor: 'bg-red-100 border-red-300' 
  }
};

export default function ProfileApplicationsPage() {
  const router = useRouter();
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | StatusKey>('all');

  // 로그인 체크
  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
    }
  }, [uid, router]);

  // 지원서 목록 가져오기
  useEffect(() => {
    if (!uid) return;

    const fetchApplications = async () => {
      try {
        setLoading(true);
        const applicationsRef = collection(db, 'applications');
        const q = query(
          applicationsRef,
          where('userId', '==', uid),
          orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const apps: Application[] = [];
        
        snapshot.forEach((doc) => {
          apps.push({ id: doc.id, ...doc.data() } as Application);
        });

        setApplications(apps);
      } catch (error) {
        console.error('지원서 목록 로드 실패:', error);
        alert('지원서 목록을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, [uid]);

  // 필터링된 지원서
  const filteredApplications = applications.filter(app => 
    filter === 'all' || app.status === filter
  );

  // 상태별 카운트
  const getStatusCount = (status: StatusKey) => {
    return applications.filter(app => app.status === status).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl font-semibold">지원 현황을 불러오는 중...</p>
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
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center">
                <Briefcase className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900">지원 현황</h1>
                <p className="text-gray-600 text-lg">내가 지원한 채용공고를 확인하세요</p>
              </div>
            </div>

            {/* 상태별 통계 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div 
                onClick={() => setFilter('all')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  filter === 'all' 
                    ? 'bg-indigo-100 border-indigo-300 shadow-lg' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600">{applications.length}</p>
                  <p className="text-sm text-gray-600 font-semibold">전체</p>
                </div>
              </div>

              {Object.entries(STATUS_INFO).map(([status, info]) => (
                <div 
                  key={status}
                  onClick={() => setFilter(status as StatusKey)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    filter === status 
                      ? `${info.bgColor} shadow-lg` 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${info.color}`}>
                      {getStatusCount(status as StatusKey)}
                    </p>
                    <p className="text-sm text-gray-600 font-semibold">{info.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 지원서 목록 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
          {filteredApplications.length === 0 ? (
            <div className="p-20 text-center">
              <Briefcase className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {filter === 'all' ? '지원한 채용공고가 없습니다' : `${STATUS_INFO[filter as StatusKey]?.label} 상태의 지원서가 없습니다`}
              </h3>
              <p className="text-gray-600 text-lg mb-8">
                관심있는 채용공고에 지원해보세요!
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all shadow-lg"
              >
                채용공고 찾아보기
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredApplications.map((app) => {
                const statusInfo = STATUS_INFO[app.status];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div 
                    key={app.id} 
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
                                  {app.jobTitle}
                                </h3>
                                <div className="flex items-center gap-2 text-gray-600 mb-2">
                                  <Building2 className="w-4 h-4" />
                                  <span className="font-semibold">{app.company}</span>
                                </div>
                              </div>
                              
                              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${statusInfo.bgColor}`}>
                                <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                                <span className={`font-bold text-sm ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  지원일: {app.createdAt?.toDate ? app.createdAt.toDate().toLocaleDateString('ko-KR') : '-'}
                                </span>
                              </div>
                              {app.updatedAt && (
                                (() => {
                                  const createdTime = app.createdAt?.toDate ? app.createdAt.toDate().getTime() : 0;
                                  const updatedTime = app.updatedAt?.toDate ? app.updatedAt.toDate().getTime() : 0;
                                  return updatedTime !== createdTime;
                                })() && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      업데이트: {app.updatedAt?.toDate ? app.updatedAt.toDate().toLocaleDateString('ko-KR') : '-'}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                            
                            <div className="flex gap-3">
                              <button
                                onClick={() => router.push(`/applications/${app.id}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors font-semibold"
                              >
                                <Eye className="w-4 h-4" />
                                지원서 확인
                              </button>
                              
                              <button
                                onClick={() => router.push(`/jobs/${app.jobId}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                              >
                                <Building2 className="w-4 h-4" />
                                채용공고 보기
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        {applications.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push('/')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all shadow-lg"
            >
              더 많은 채용공고 찾아보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
