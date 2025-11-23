"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase';
import { 
  collection, 
  query, 
  where,
  getDocs, 
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { 
  Bell,
  BellOff,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Eye,
  Calendar,
  Briefcase
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'status_change';
  title: string;
  body: string;
  data: {
    applicationId: string;
    jobTitle: string;
    oldStatus: string;
    newStatus: string;
  };
  notice: boolean;
  read: boolean;
  pushTime: any;
  badge: number;
  createdAt: any;
}

const STATUS_LABELS: { [key: string]: string } = {
  submitted: '제출',
  reviewed: '검토중',
  interview: '면접',
  accepted: '합격',
  rejected: '불합격'
};

const STATUS_ICONS: { [key: string]: React.ReactNode } = {
  reviewed: <Eye className="w-5 h-5" />,
  interview: <Calendar className="w-5 h-5" />,
  accepted: <CheckCircle className="w-5 h-5" />,
  rejected: <XCircle className="w-5 h-5" />
};

const STATUS_COLORS: { [key: string]: string } = {
  reviewed: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  interview: 'bg-purple-100 text-purple-700 border-purple-300',
  accepted: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300'
};

export default function NotificationsPage() {
  const router = useRouter();
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalNotice, setGlobalNotice] = useState(true); // 전체 알림 설정

  useEffect(() => {
    if (!uid) {
      alert('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    loadNotifications();
    loadNoticeSettings();
  }, [uid]);

  const loadNotifications = async () => {
    if (!uid) return;

    try {
      setLoading(true);
      const notificationsRef = collection(db, 'push', uid, 'notifications');
      const q = query(notificationsRef, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      const notiList: Notification[] = [];
      
      snapshot.forEach((doc) => {
        notiList.push({ id: doc.id, ...doc.data() } as Notification);
      });

      setNotifications(notiList);
    } catch (error) {
      console.error('알림 로드 실패:', error);
      alert('알림을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadNoticeSettings = async () => {
    if (!uid) return;

    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setGlobalNotice(userData.notificationsEnabled !== false);
      }
    } catch (error) {
      console.error('알림 설정 로드 실패:', error);
    }
  };

  const toggleGlobalNotice = async () => {
    if (!uid) return;

    try {
      const newValue = !globalNotice;
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        notificationsEnabled: newValue
      });

      setGlobalNotice(newValue);
      alert(newValue ? '✅ 알림이 활성화되었습니다.' : '🔕 알림이 비활성화되었습니다.');
    } catch (error) {
      console.error('알림 설정 변경 실패:', error);
      alert('알림 설정 변경 중 오류가 발생했습니다.');
    }
  };

  const toggleNotice = async (notificationId: string, currentNotice: boolean) => {
    if (!uid) return;

    try {
      const notificationRef = doc(db, 'push', uid, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        notice: !currentNotice
      });

      setNotifications(prev =>
        prev.map(noti =>
          noti.id === notificationId ? { ...noti, notice: !currentNotice } : noti
        )
      );

      alert(!currentNotice ? '🔔 알림 활성화' : '🔕 알림 비활성화');
    } catch (error) {
      console.error('알림 토글 실패:', error);
      alert('알림 설정 변경 중 오류가 발생했습니다.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!uid) return;

    const confirmed = window.confirm('이 알림을 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      const notificationRef = doc(db, 'push', uid, 'notifications', notificationId);
      await deleteDoc(notificationRef);

      setNotifications(prev => prev.filter(noti => noti.id !== notificationId));
      alert('✅ 알림이 삭제되었습니다.');
    } catch (error) {
      console.error('알림 삭제 실패:', error);
      alert('알림 삭제 중 오류가 발생했습니다.');
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!uid) return;

    try {
      const notificationRef = doc(db, 'push', uid, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });

      setNotifications(prev =>
        prev.map(noti =>
          noti.id === notificationId ? { ...noti, read: true } : noti
        )
      );
    } catch (error) {
      console.error('읽음 처리 실패:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 text-xl font-semibold">알림을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 뒤로가기 */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-700 hover:text-indigo-600 transition font-semibold text-lg"
          >
            <ArrowLeft className="w-6 h-6" />
            홈으로 돌아가기
          </button>
        </div>

        {/* 헤더 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl">
                <Bell className="w-10 h-10 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">알림 관리</h1>
                <p className="text-gray-600 text-lg">
                  총 <span className="font-bold text-indigo-600">{notifications.length}</span>개의 알림
                </p>
              </div>
            </div>

            {/* 전체 알림 토글 */}
            <button
              onClick={toggleGlobalNotice}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold shadow-lg transition-all ${
                globalNotice
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {globalNotice ? (
                <>
                  <Bell className="w-6 h-6" />
                  알림 활성화
                </>
              ) : (
                <>
                  <BellOff className="w-6 h-6" />
                  알림 비활성화
                </>
              )}
            </button>
          </div>
        </div>

        {/* 알림 목록 */}
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xl p-20 text-center border border-gray-200">
              <BellOff className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <p className="text-gray-500 text-2xl font-semibold">알림이 없습니다</p>
            </div>
          ) : (
            notifications.map((noti) => {
              const statusColor = STATUS_COLORS[noti.data.newStatus] || 'bg-gray-100 text-gray-700 border-gray-300';
              const StatusIcon = STATUS_ICONS[noti.data.newStatus] || <Briefcase className="w-5 h-5" />;
              
              return (
                <div
                  key={noti.id}
                  className={`bg-white rounded-3xl shadow-lg p-6 border-2 transition-all ${
                    noti.read
                      ? 'border-gray-200'
                      : 'border-indigo-300 bg-gradient-to-r from-indigo-50/30 to-white'
                  }`}
                  onClick={() => !noti.read && markAsRead(noti.id)}
                >
                  <div className="flex items-start justify-between gap-6">
                    {/* 왼쪽: 상태 아이콘 */}
                    <div className={`p-4 rounded-2xl border-2 ${statusColor}`}>
                      {StatusIcon}
                    </div>

                    {/* 중앙: 알림 내용 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">{noti.title}</h3>
                        {!noti.read && (
                          <span className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold">
                            NEW
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 mb-3 text-base">{noti.body}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          {noti.data.jobTitle}
                        </span>
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDate(noti.pushTime || noti.createdAt)}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 ${statusColor}`}>
                          {STATUS_LABELS[noti.data.oldStatus] || noti.data.oldStatus} → {STATUS_LABELS[noti.data.newStatus] || noti.data.newStatus}
                        </span>
                      </div>
                    </div>

                    {/* 오른쪽: 액션 버튼 */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNotice(noti.id, noti.notice);
                        }}
                        className={`p-3 rounded-xl font-semibold transition-all shadow-md ${
                          noti.notice
                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        title={noti.notice ? '알림 끄기' : '알림 켜기'}
                      >
                        {noti.notice ? (
                          <Bell className="w-5 h-5" />
                        ) : (
                          <BellOff className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(noti.id);
                        }}
                        className="p-3 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 font-semibold transition-all shadow-md"
                        title="삭제"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/applications/${noti.data.applicationId}`);
                        }}
                        className="p-3 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold transition-all shadow-md"
                        title="상세보기"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}