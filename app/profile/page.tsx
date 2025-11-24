'use client';

import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Notebook, Book, ClipboardPlus, Atom, MessageSquare, TrendingUp, Users, Link as LinkIcon, Banana, Rocket, MessageCircle, Send, X, Home, FileText, Calendar, Heart, Briefcase, HelpCircle } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';
import { db } from '@/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

export default function ProfilePage() {
  const { currentUser } = useSelector((state: any) => state.user);
  const [localUser, setLocalUser] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [greetingResponses, setGreetingResponses] = useState<any[]>([]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setLocalUser(user);
      } else {
        setLocalUser(null);
      }
    });

    return () => unsubscribe();
  }, []);


  const isEnterprise = currentUser?.userType === 'enterprise';

  const allMenuItems = [
    { 
      icon: FileText, 
      label: '이력서', 
      href: '/profile/resume',
      description: '나만의 이력서 작성 및 관리',
      gradient: 'from-emerald-500 to-teal-600',
      userType: 'individual'
    },
    { 
      icon: Users, 
      label: '프로필 수정', 
      href: '/profile/edit',
      description: '내 정보 및 연락처 수정',
      gradient: 'from-blue-500 to-indigo-600',
      userType: 'all'
    },
    { 
      icon: Heart, 
      label: '찜목록', 
      href: '/profile/likes',
      description: '관심있는 채용공고 저장',
      gradient: 'from-rose-500 to-pink-600',
      userType: 'all'
    },
    { 
      icon: Briefcase, 
      label: '구인등록', 
      href: '/profile/recruit',
      description: '채용공고 등록 및 관리',
      gradient: 'from-orange-500 to-amber-600',
      userType: 'enterprise'
    },
    { 
      icon: ClipboardPlus, 
      label: '지원서', 
      href: '/profile/applications',
      description: '내가 지원한 공고 확인',
      gradient: 'from-sky-500 to-cyan-600',
      userType: 'individual'
    },
    { 
      icon: Users, 
      label: '채용공고관리', 
      href: '/profile/recruit-manage',
      description: '등록한 채용공고 지원자 관리',
      gradient: 'from-blue-500 to-indigo-600',
      userType: 'enterprise'
    },
    { 
      icon: HelpCircle, 
      label: '문의', 
      href: '/profile/inquiry',
      description: '고객지원 및 문의사항',
      gradient: 'from-gray-500 to-slate-600',
      userType: 'all'
    },
   
  ];

  const [menuItems, setMenuItems] = useState(allMenuItems.filter(item => item.userType === 'all' || item.userType === 'individual'));

  useEffect(() => {
    // 클라이언트에서만 실행되어 isEnterprise 값이 정확할 때 메뉴를 다시 필터링합니다.
    const filteredMenuItems = allMenuItems.filter(item => {
      if (item.userType === 'all') return true;
      if (item.userType === 'enterprise' && isEnterprise) return true;
      if (item.userType === 'individual' && !isEnterprise) return true;
      return false;
    });
    setMenuItems(filteredMenuItems);
  }, [isEnterprise]);


  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', { // 이 부분은 클라이언트에서만 실행되도록 보장됩니다.
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', { // 이 부분도 마찬가지입니다.
      year: '2-digit',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };


  const getGreeting = () => {
    const hour = new Date().getHours();
    
    if (hour >= 0 && hour <= 5) {
        // 심야: 00:00 - 05:59
        return '잠 못 이루는 새벽이세요?';
    } else if (hour >= 6 && hour <= 9) {
        // 아침 시작: 06:00 - 09:59
        return '어제 잠은 잘 주무셨나요?';
    } else if (hour >= 10 && hour <= 11) {
        // 오전 활동: 10:00 - 11:59
        return '오늘 아침 식사는 하셨나요?';
    } else if (hour >= 12 && hour <= 13) {
        // 점심: 12:00 - 13:59
        return '오늘 맛있는 점심식사 하셨나요?';
    } else if (hour >= 14 && hour <= 17) {
        // 오후 활동/피곤: 14:00 - 17:59
        return '오늘 저녁 약속은 있으세요?';
    } else if (hour >= 18 && hour <= 20) {
        // 저녁: 18:00 - 20:59
        return '오늘 저녁 식사 후 산책 또는 운동하셨나요?';
    } else { // 21:00 - 23:59 (밤/취침 전)
        return '오늘은 어떠셨나요?';
    }
};



  // 이메일 표시 (실명 제거, 이메일만)
  const getDisplayName = (user: User | null) => {
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0];
      // 6자 초과 시 앞6자... 형태, 6자 이하면 전체 표시
      return emailPrefix.length > 6 ? `${emailPrefix.substring(0, 6)}...` : emailPrefix;
    }
    return '유저님';
  };




  return (
    <div className="flex-1 md:p-6 py-6 overflow-auto">
      <div className="px-2 md:px-0 space-y-8">
        {/* 환영 메시지 및 시간 - 프리미엄 디자인 */}
        <div className="relative bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 overflow-hidden">
          {/* 배경 장식 */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-cyan-500/5"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <img 
                        src="/Image/logo.png" 
                        alt="모두잡AI" 
                        className="w-7 h-7"
                      />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
                        {getGreeting()}
                      </h1>
                      <p className="text-sm text-gray-400">
                        {getDisplayName(currentUser || localUser)}님, 오늘도 좋은 하루 되세요! ✨
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-lg font-semibold text-white">
                      {formatTime(currentTime)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {formatDate(currentTime)}
                    </div>
                  </div>
                </div>
                
                {/* 전체 답변 목록 - 커뮤니티 */}
                {greetingResponses.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      💬 실시간 커뮤니티 답변
                    </div>
                    <div className="grid gap-3 max-h-40 overflow-y-auto">
                      {greetingResponses.slice(0, 3).map((response) => (
                        <div key={response.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-xs text-white font-bold">
                                {response.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-emerald-400 text-sm">{response.userName}</span>
                                <span className="text-xs text-gray-500">
                                  {response.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-gray-200 text-sm leading-relaxed">
                                {response.response}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {greetingResponses.length > 3 && (
                      <Link 
                        href="/profile/greeting-responses"
                        className="text-sm text-emerald-400 hover:text-emerald-300 text-center py-2 block transition-colors cursor-pointer font-medium"
                      >
                        +{greetingResponses.length - 3}개 더 보기 →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        

        {/* 메인 메뉴 - 프리미엄 디자인 */}
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">서비스 메뉴</h2>
              <p className="text-sm text-gray-400">원하는 서비스를 선택하세요</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {menuItems.map((item, index) => (
              <Link
                key={index}
                href={item.href}
                className="group relative bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-2xl overflow-hidden"
              >
                {/* 배경 장식 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${item.gradient}/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white transition-colors duration-300">
                      {item.label}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors">
                      {item.description}
                    </p>
                  </div>
                  
                  {/* 호버 시 화살표 */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className={`w-2 h-2 bg-gradient-to-r ${item.gradient} rounded-full opacity-60`}></div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}