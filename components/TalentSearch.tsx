"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, Heart, X, Filter, Sparkles, Users, ChevronDown, Plus, Briefcase } from 'lucide-react';
import { db } from '@/firebase';
import { doc,  query as fsQuery, collection, where, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import {
  Job,
  SearchParams,
  ProcessingStatus,
  EDUCATION_MAP,
} from "@/lib/job";
import { REGION_CODES } from "@/lib/localcode";

// 성능 최적화를 위한 지역명 Set 생성 (한 번만 실행)
const createRegionKeywordsSet = () => {
  const keywords = new Set<string>();
  
  Object.keys(REGION_CODES).forEach(regionName => {
    if (regionName === "지역무관") return;
    
    // 원본 지역명 추가
    keywords.add(regionName.toLowerCase());
    
    // "서울 강남구" -> "강남구", "강남" 추가
    const parts = regionName.split(' ');
    if (parts.length > 1) {
      const district = parts[1];
      keywords.add(district.toLowerCase());
      
      // "강남구" -> "강남" (구/시 제거)
      const withoutSuffix = district.replace(/(구|시|군)$/, '');
      if (withoutSuffix !== district) {
        keywords.add(withoutSuffix.toLowerCase());
      }
    }
    
    // "서울" -> 시/도명만 추가
    const mainRegion = parts[0];
    keywords.add(mainRegion.toLowerCase());
  });
  
  return keywords;
};

// 지역 키워드 Set (앱 시작 시 한 번만 생성)
const REGION_KEYWORDS_SET = createRegionKeywordsSet();

// 검색어에 지역 정보가 포함되어 있는지 확인 (최적화된 버전)
const hasRegionInQuery = (query: string): boolean => {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);
  
  // 각 단어가 지역 키워드인지 확인
  return words.some(word => REGION_KEYWORDS_SET.has(word));
};

interface Resume {
  id: string;
  name: string;
  profileImageUrl?: string;
  latest_update?: string;
  workType: string[];
  regionCodes: string[];
  selectedJobs: string[];
  totalCareerMonths?: number;
  yearsOfExperience?: number;
  birthYear?: number;
  languageNames: string[];
  certificateNames: string[];
  skills: string[];
  careerSummary?: string;
  educationLevelCode?: number;
  disability?: string;
}

interface TalentSearchProps {
  searchMode: 'jobs' | 'talents';
  setSearchMode: (mode: 'jobs' | 'talents') => void;
}

export default function TalentSearch({ searchMode, setSearchMode }: TalentSearchProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'talents'>('talents');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<SearchParams | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<ProcessingStatus>({
    stage: 'idle',
    message: '검색 대기 중',
    progress: 0,
  });
  const [summaryAnswer, setSummaryAnswer] = useState('');
  const [likedResumes, setLikedResumes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [firebaseResumes, setFirebaseResumes] = useState<Resume[]>([]);
  const [firebaseResumesCount, setFirebaseResumesCount] = useState(0);
  const [nextLastDocId, setNextLastDocId] = useState<string | null>(null);
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  const RESUME_SEARCH_STREAM_URL = process.env.NEXT_PUBLIC_TALENT_SEARCH_API_URL;

  const TALENT_SEARCH_CACHE_KEY = 'talentSearchState';

  const searchOptions = [
    { 
      value: 'jobs', 
      label: '일자리 찾기', 
      icon: Briefcase,
    },
    { 
      value: 'talents', 
      label: '인재 찾기', 
      icon: Users,
    }
  ];

  const currentOption = searchOptions.find(option => option.value === searchMode);

   // ✅ 페이지 로드 시 저장된 상태 복원
  useEffect(() => {
    const savedState = sessionStorage.getItem(TALENT_SEARCH_CACHE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // 30분 이내 데이터만 복원
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          setQuery(parsed.query || '');
          setFirebaseResumes(parsed.firebaseResumes || []);
          setFirebaseResumesCount(parsed.firebaseResumesCount || 0);
          setParams(parsed.params || null);
          setSummaryAnswer(parsed.summaryAnswer || '');
          setCurrentPage(parsed.currentPage || 1);
          setHasMore(parsed.hasMore || false);
          setNextLastDocId(parsed.nextLastDocId || null);
          setActiveTab(parsed.activeTab || 'talents');
          
          // 결과가 있으면 talents 탭으로 설정
          if (parsed.firebaseResumes?.length > 0) {
            setActiveTab('talents');
          }
        }
      } catch (e) {
        console.error('저장된 검색 상태 복원 실패:', e);
      }
    }
  }, []);

  // ✅ 검색 상태가 변경될 때마다 저장
  useEffect(() => {
    if (query && firebaseResumes.length > 0) {
      const stateToSave = {
        query,
        firebaseResumes,
        firebaseResumesCount,
        params,
        summaryAnswer,
        currentPage,
        hasMore,
        nextLastDocId,
        activeTab,
        timestamp: Date.now()
      };
      
      try {
        sessionStorage.setItem(TALENT_SEARCH_CACHE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        // 용량 초과시 summaryAnswer만 줄이기
        stateToSave.summaryAnswer = summaryAnswer.slice(0, 1000);
        try {
          sessionStorage.setItem(TALENT_SEARCH_CACHE_KEY, JSON.stringify(stateToSave));
        } catch (e2) {
          console.warn('sessionStorage 저장 실패:', e2);
        }
      }
    }
  }, [query, firebaseResumes, firebaseResumesCount, params, summaryAnswer, currentPage, hasMore, nextLastDocId, activeTab]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
    };
  }, []);

  // ✅ 찜 목록 로드
   useEffect(() => {
   const loadLikes = async () => {
     if (!uid) { // 비로그인 시
         // 로그인 안 했으면 로컬스토리지
         const saved = localStorage.getItem('profeLikes');
         if (saved) {
           try {
             setLikedResumes(new Set(JSON.parse(saved)));
           } catch (e) {
             console.error('찜 목록 로드 실패:', e);
           }
         }
         return;
       }

      // 로그인 시 Firestore에서 로드
     try {
       const q = fsQuery(
         collection(db, "profeLikes"),
         where("userId", "==", uid)
       );
       const snap = await getDocs(q);

       const likedSet = new Set(snap.docs.map(doc => doc.data().resumeId));
       setLikedResumes(likedSet);
     } catch (err) {
       console.error("찜 로드 실패:", err);
     }
   };

   loadLikes();
 }, [uid]);
 
   const toggleResumeLike = async (resume: Resume) => {
   if (!uid) { // 비로그인 시 로컬스토리지 사용
     const newSet = new Set(likedResumes);
     if (newSet.has(resume.id)) {
       newSet.delete(resume.id);
     } else {
       newSet.add(resume.id);
     }
     setLikedResumes(newSet);
     localStorage.setItem('profeLikes', JSON.stringify(Array.from(newSet)));
     return;
   }
 
   // 로그인 시 Firestore 사용
   const isLiked = likedResumes.has(resume.id);
   const newSet = new Set(likedResumes);
 
   const docId = `${uid}_${resume.id}`;
   const likeRef = doc(db, "profeLikes", docId);
 
   try {
     if (isLiked) {
       // 삭제
       await deleteDoc(likeRef);
       newSet.delete(resume.id);
     } else {
       // 저장
       await setDoc(likeRef, {
         userId: uid,
         resumeId: resume.id,
         name: resume.name,
         profileImageUrl: resume.profileImageUrl || null,
         careerSummary: resume.careerSummary || '',
         createdAt: new Date().toISOString(),
       });
       newSet.add(resume.id);
     }
 
     setLikedResumes(newSet);
   } catch (err) {
     console.error("찜 저장 실패:", err);
   }
 };

  const updateStatus = useCallback((stage: string, message: string, progress: number) => {
    setStatus({ stage, message, progress });
  }, []);

   const handleResumeClick = (resume: Resume) => {
    // 현재 상태를 저장한 후 이동
    const currentState = {
      query,
      firebaseResumes,
      firebaseResumesCount,
      params,
      summaryAnswer,
      currentPage,
      hasMore,
      nextLastDocId,
      activeTab,
      timestamp: Date.now()
    };
    
    try {
      sessionStorage.setItem(TALENT_SEARCH_CACHE_KEY, JSON.stringify(currentState));
    } catch (e) {
      console.warn('상태 저장 실패:', e);
    }
    
    window.location.href = `/resume/preview/${resume.id}`;
  };

  const handleSearch = async (page: number = 1, isLoadMore: boolean = false) => {
    if (!query.trim()) {
      alert('검색어를 입력하세요.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (e) {
        console.warn('Reader cancel failed:', e);
      }
      readerRef.current = null;
    }

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
      setSummaryAnswer('');
      setParams(null);
      setFirebaseResumes([]);
      setFirebaseResumesCount(0);
      setNextLastDocId(null);
      setCurrentPage(1);
      setHasMore(false);
      // 새 검색이면 기존 캐시 클리어
      sessionStorage.removeItem(TALENT_SEARCH_CACHE_KEY);
    }
    
    updateStatus('started', '검색 시작...', 5);
    abortControllerRef.current = new AbortController();

    try {
      // 사용자의 지역 정보 가져오기
      const userSubRegion = currentUser?.subRegion;
      const hasRegion = hasRegionInQuery(query.trim());
      
      const requestBody: any = {
        query: query.trim(),
        limit: 15,
        lastDocId: isLoadMore && nextLastDocId ? nextLastDocId : undefined,
      };

      // 검색어에 지역 정보가 없고 사용자에게 저장된 지역 정보가 있으면 추가
      if (userSubRegion && !hasRegion) {
        requestBody.region = userSubRegion;
      }

      if (!RESUME_SEARCH_STREAM_URL) {
        throw new Error("API URL이 설정되지 않았습니다. NEXT_PUBLIC_TALENT_SEARCH_API_URL 환경 변수를 확인해주세요.");
      }

      const response = await fetch(RESUME_SEARCH_STREAM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `서버 오류: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('응답 본문이 없습니다.');
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) {
            currentEvent = '';
            continue;
          }

          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            const jsonStr = line.substring(5).trim();
            if (!jsonStr || jsonStr.length < 2) continue;

            let data;
            try {
              data = JSON.parse(jsonStr);
            } catch {
              console.warn('JSON 파싱 실패:', jsonStr);
              continue;
            }

            // SSE 이벤트 처리
            if (currentEvent === 'status') {
              if (data.status === 'extracting_params') {
                updateStatus('extract', '🔍 조건 분석 중...', 10);
              } else if (data.status === 'searching') {
                updateStatus('search', '🔥 인재 검색 중...', 30);
              }
            } else if (currentEvent === 'params') {
              setParams(data.params);
              updateStatus('extract', '✅ 분석 완료', 20);
            } else if (currentEvent === 'result') {
              if (data.resume) {
                if (isLoadMore) {
                  setFirebaseResumes(prev => [...prev, data.resume]);
                } else {
                  setFirebaseResumes(prev => [...prev, data.resume]);
                }
                updateStatus('search', `🔥 인재 ${data.index + 1}명 발견...`, 50 + (data.index * 2));
              }
            } else if (currentEvent === 'complete') {
              updateStatus('complete', '✅ 인재 검색 완료', 100);
              setFirebaseResumesCount(data.total || 0);
              setNextLastDocId(data.nextLastDocId || null);
              setHasMore(!!data.nextLastDocId);
              setLoading(false);
              setLoadingMore(false);
            } else if (currentEvent === 'error') {
              throw new Error(data.error || '인재 검색 실패');
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('요청 취소됨');
        return;
      }

      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      
      if (firebaseResumes.length > 0) {
        setError(`일부 데이터 로드 실패: ${errorMsg}`);
      } else {
        setError(`연결 오류: ${errorMsg}`);
      }
      updateStatus('error', '오류 발생', 0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      readerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLoadingMore(false);
      updateStatus('idle', '검색 취소됨', 0);
    }
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      handleSearch(currentPage + 1, true);
    }
  };

  const handleOptionSelect = (value: 'jobs' | 'talents') => {
    setSearchMode(value);
    setIsDropdownOpen(false);
  };

  const exampleQueries = currentUser?.subRegion ? [
    '백엔드 개발자 경력 5년 이상',  // 지역 없음 - 사용자 지역 자동 적용
    'React 프론트엔드 개발자',  // 지역 없음 - 사용자 지역 자동 적용
    '서울 강남 AI 연구원',  // 지역 명시 - 서울 강남으로 검색
    '영어 능숙한 데이터 사이언티스트',  // 지역 없음 - 사용자 지역 자동 적용
  ] : [
    '서울 백엔드 개발자 경력 5년 이상',
    'React 프론트엔드 개발자',
    '영어 능숙한 데이터 사이언티스트',
    '석사 학위 소지한 AI 연구원',
  ];

  return (
      <>
        {/* 검색 바 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-gray-200 p-6 mb-8">
          <div className="flex gap-2 items-center">
            {/* 드롭다운 선택 */}
            <div className="relative" ref={dropdownRef}>
              <button // 모바일에서는 다이얼로그, 데스크톱에서는 드롭다운
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-center md:justify-start md:gap-3 h-[56px] w-[56px] md:w-auto md:px-6 bg-white border-2 border-gray-300 rounded-2xl hover:border-gray-400 focus:border-purple-500 focus:outline-none md:min-w-[180px] shadow-sm transition-all"
              >
                <div className="rounded-full">
                  <Plus className="w-4 h-4 text-gray-600" />
                </div>
                <div className="text-left flex-1 hidden md:block">
                  <div className="font-semibold text-gray-900 text-sm">
                    {currentOption?.label}
                  </div>
                </div>
                <ChevronDown 
                  className={`w-4 h-4 text-gray-400 transition-transform hidden md:block ${
                    isDropdownOpen ? 'transform rotate-180' : ''
                  }`} 
                />
              </button>

              {/* 드롭다운 메뉴 */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-60 bg-white border-2 border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  {searchOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = searchMode === option.value;
                    
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleOptionSelect(option.value as 'jobs' | 'talents')}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                          isSelected ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                        }`}
                      >
                        <div className={`p-2 rounded-full ${
                          option.value === 'jobs' 
                            ? 'bg-blue-100' 
                            : 'bg-purple-100'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            option.value === 'jobs' 
                              ? 'text-blue-600' 
                              : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {option.label}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="ml-auto">
                            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
              <input
                type="text"
                placeholder={
                  currentUser?.subRegion 
                    ? "직무, 기술스택, 자격증으로 검색하세요 (지역은 자동으로 설정됩니다)" 
                    : "시·군·구 + 직무, 기술스택, 자격증으로 검색하세요"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
                className="w-full pl-14 pr-6 py-4 border-2 border-gray-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 text-base transition-all placeholder:text-gray-400"
                disabled={loading}
              />
            </div>

            {loading ? (
              <button
                onClick={handleCancel}
                className="flex items-center justify-center gap-2 bg-red-600 text-white h-[56px] w-[56px] md:w-auto md:px-6 rounded-2xl hover:bg-red-700 transition font-semibold shadow-lg"
              >
                <X className="w-5 h-5" />
                <span className="hidden md:inline">취소</span>
              </button>
            ) : (
              <button
                onClick={() => handleSearch()}
                className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium h-[56px] w-[56px] md:w-auto md:px-8 rounded-2xl"
                disabled={!query.trim()}
              >
                <Search className="w-5 h-5 md:hidden" />
                <span className="hidden md:inline">AI 검색</span>
              </button>
            )}
          </div>

          {/* 예시 검색어 */}
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-600 font-semibold">💡 추천 검색:</span>
            {exampleQueries.map((example) => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm hover:bg-purple-100 transition border border-purple-200"
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>

          {/* 사용자 지역 정보 표시 */}
          {currentUser?.subRegion && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-purple-600 font-semibold">📍 기본 검색 지역:</span>
              <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium border border-purple-200">
                {currentUser.subRegion}
              </span>
              <span className="text-gray-500">
                (검색어에 지역명이 없으면 자동 적용됩니다)
              </span>
            </div>
          )}
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-red-50 rounded-3xl p-8 mb-8 shadow-2xl border-2 border-purple-300">
            <div className="flex items-center gap-4 mb-5">
              <Loader2 className="animate-spin h-9 w-9 text-purple-600" />
              <span className="font-bold text-purple-900 text-2xl">{status.message}</span>
            </div>
            
            <div className="w-full bg-white/70 rounded-full h-5 overflow-hidden shadow-inner">
              <div 
                className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 h-full transition-all duration-500 ease-out shadow-lg"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-3xl p-6 mb-8 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="text-4xl">❌</div>
              <div className="flex-1">
                <p className="text-red-900 font-bold text-xl mb-2">오류 발생</p>
                <p className="text-red-800 text-lg">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-red-600 text-sm mt-4 hover:underline font-bold"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 검색 파라미터 */}
        {params && (
          <div className="mb-8 bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Filter className="w-6 h-6 text-purple-600" />
              <span className="font-bold text-gray-900 text-xl">검색 조건</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {params.searchKeywords && params.searchKeywords.length > 0 && (
                <span className="px-5 py-2.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 rounded-full font-bold shadow-md">
                  🔍 {params.searchKeywords.join(', ')}
                </span>
              )}
              {params.languageNames && params.languageNames.length > 0 && (
                <span className="px-5 py-2.5 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 rounded-full font-bold shadow-md">
                  외국어 {params.languageNames.join(', ')}
                </span>
              )}
              {params.certificateNames && params.certificateNames.length > 0 && (
                <span className="px-5 py-2.5 bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 rounded-full font-bold shadow-md">
                  자격증 {params.certificateNames.join(', ')}
                </span>
              )}
              {firebaseResumesCount > 0 && (
                <span className="ml-auto px-6 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-full font-bold shadow-lg text-base">
                  총 {firebaseResumesCount.toLocaleString()}명
                </span>
              )}
            </div>
          </div>
        )}

        {/* 인재 리스트 */}
        {firebaseResumes.length > 0 && (
          <div className="space-y-4">
            {firebaseResumes.map((resume) => {
              const isLiked = likedResumes.has(resume.id);
              
              return (
                <div
                  key={resume.id}
                  className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group border border-purple-200 bg-gradient-to-r from-purple-50/50 to-white hover:border-purple-300"
                  onClick={() => handleResumeClick(resume)} // ✅ 수정된 클릭 핸들러
                >
                  <div className="flex items-start gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                            <span className="text-sm">🧑‍💻</span>
                            인재
                          </span>
                          {resume.yearsOfExperience !== undefined && (
                            <span className="px-3 py-1 bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 rounded-full text-xs font-semibold">
                              경력 {resume.yearsOfExperience}년
                            </span>
                          )}
                          {resume.educationLevelCode !== undefined && (
                            <span className="px-3 py-1 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-full text-xs font-semibold">
                              {EDUCATION_MAP[resume.educationLevelCode] || resume.educationLevelCode}
                            </span>
                          )}
                        </div>
                        
                        {/* ✅ 찜 버튼 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleResumeLike(resume);
                          }}
                          className={`p-2 rounded-full transition-all hover:scale-110 ${
                            isLiked
                              ? 'bg-pink-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isLiked ? 'fill-white' : ''}`} />
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors line-clamp-2">
                          {resume.name} {resume.birthYear && <span className="font-normal text-gray-600">({resume.birthYear}년생)</span>}
                        </h3>
                        {resume.careerSummary && (
                          <p className="text-sm text-gray-700 line-clamp-2">
                            <span className="font-semibold text-purple-900">요약:</span> {resume.careerSummary}
                          </p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
                        {resume.regionCodes && resume.regionCodes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-base">📍</span>
                            <span className="truncate">{resume.regionCodes.map(code => Object.keys(REGION_CODES).find(key => REGION_CODES[key as keyof typeof REGION_CODES] === code) || code).join(', ')}</span>
                          </div>
                        )}
                        {resume.skills && resume.skills.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-base">💡</span>
                            <span className="truncate">{resume.skills.join(', ')}</span>
                          </div>
                        )}
                        {resume.languageNames && resume.languageNames.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-base">🗣️</span>
                            <span className="truncate">{resume.languageNames.join(', ')}</span>
                          </div>
                        )}
                        {resume.certificateNames && resume.certificateNames.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-base">📜</span>
                            <span className="truncate">{resume.certificateNames.join(', ')}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-base">⏰</span>
                          <span>최근 업데이트: <strong className="text-gray-900">{resume.latest_update ? new Date(resume.latest_update).toLocaleDateString() : '알 수 없음'}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* 더 보기 버튼 */}
           {hasMore && (
              <div className="flex justify-center pt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white rounded-2xl hover:from-purple-700 hover:via-pink-700 hover:to-red-700 font-bold text-lg shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      로딩 중...
                    </>
                  ) : (
                    <>
                      더 보기 (15명씩)
                      <span className="text-2xl">⬇️</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
     </>
  );
}