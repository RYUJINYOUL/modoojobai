"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, Heart, ExternalLink, X, Filter, Briefcase, Sparkles, ChevronDown, Plus, Users } from 'lucide-react';
import { db } from '@/firebase';
import { doc,  query as fsQuery, collection, where, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { useSelector } from 'react-redux';

import {
  Job,
  SearchParams,
  ProcessingStatus,
  REGION_NAMES,
  OCCUPATION_NAMES,
  CAREER_NAMES,
  EMPLOYMENT_NAMES,
} from "@/lib/job";
import { REGION_CODES } from "@/lib/localcode";

const ITEMS_PER_PAGE = 15;

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

interface JobSearchProps {
  searchMode: 'jobs' | 'talents';
  setSearchMode: (mode: 'jobs' | 'talents') => void;
}

export default function JobSearch({ searchMode, setSearchMode }: JobSearchProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'jobs'>('summary');
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
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const [firebaseJobs, setFirebaseJobs] = useState<Job[]>([]);
  const [work24Jobs, setWork24Jobs] = useState<Job[]>([]);
  const [firebaseCount, setFirebaseCount] = useState(0);
  const [work24Count, setWork24Count] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'firebase' | 'work24'>('all');
  
  const currentUser = useSelector((state: any) => state.user?.currentUser);
  const uid = currentUser?.uid;

  const API_BASE = process.env.NEXT_PUBLIC_AIJOB_API_BASE;
  const API_URL = `${API_BASE}/stream`;

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

  const displayedJobs = useMemo(() => {
    if (activeFilter === 'firebase') return firebaseJobs;
    if (activeFilter === 'work24') return work24Jobs;
    return [...firebaseJobs, ...work24Jobs];
  }, [activeFilter, firebaseJobs, work24Jobs]);
  
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

  useEffect(() => {
    const loadLikes = async () => {
      if (!uid) { // 비로그인 시
          // 로그인 안 했으면 로컬스토리지
          const saved = localStorage.getItem('recruitLikes');
          if (saved) {
            try {
              setSavedJobs(new Set(JSON.parse(saved)));
            } catch (e) {
              console.error('찜 목록 로드 실패:', e);
            }
          }
          return;
        }

       // 로그인 시 Firestore에서 로드
      try {
        const q = fsQuery(
          collection(db, "recruitLikes"),
          where("userId", "==", uid)
        );
        const snap = await getDocs(q);

        const likedSet = new Set(snap.docs.map(doc => doc.data().jobId));
        setSavedJobs(likedSet);
      } catch (err) {
        console.error("찜 로드 실패:", err);
      }
    };

    loadLikes();
  }, [uid]);

  const toggleLike = async (job: Job) => {
    if (!uid) { // 비로그인 시 로컬스토리지 사용
      const newSet = new Set(savedJobs);
      if (newSet.has(job.id)) {
        newSet.delete(job.id);
      } else {
        newSet.add(job.id);
      }
      setSavedJobs(newSet);
      localStorage.setItem('recruitLikes', JSON.stringify(Array.from(newSet)));
      return;
    }
  
    // 로그인 시 Firestore 사용
    const isLiked = savedJobs.has(job.id);
    const newSet = new Set(savedJobs);
  
    const docId = `${uid}_${job.id}`;
    const likeRef = doc(db, "recruitLikes", docId);
  
    try {
      if (isLiked) {
        // 삭제
        await deleteDoc(likeRef);
        newSet.delete(job.id);
      } else {
        // 저장
        await setDoc(likeRef, {
          userId: uid,
          jobId: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          deadline: job.deadline,
          url: job.url,
          createdAt: new Date().toISOString(),
        });
        newSet.add(job.id);
      }
  
      setSavedJobs(newSet);
    } catch (err) {
      console.error("찜 저장 실패:", err);
    }
  };

  const updateStatus = useCallback((stage: string, message: string, progress: number) => {
    setStatus({ stage, message, progress });
  }, []);

  const processSSEData = useCallback((data: any, isLoadMore: boolean) => {
    if (data.stage === 'cache' && data.status === 'hit') {
      updateStatus('cache', data.message || '💾 캐시된 결과', data.progress || 20);
      setFromCache(true);
    }
    else if (data.stage === 'extract') {
      if (data.status === 'started') {
        updateStatus('extract', data.message || '🔍 조건 분석 중...', data.progress || 10);
      } else if (data.status === 'finished') {
        setParams(data.params);
        updateStatus('extract', data.message || '✅ 분석 완료', data.progress || 15);
      }
    }
    else if (data.stage === 'firebase_search') {
      if (data.status === 'started') {
        updateStatus('firebase_search', data.message || '🔥 자사 검색 중...', data.progress || 20);
      } else if (data.status === 'finished') {
        const fbJobs = data.jobs || [];
        if (isLoadMore) {
          setFirebaseJobs(prev => [...prev, ...fbJobs]);
        } else {
          setFirebaseJobs(fbJobs);
        }
        setFirebaseCount(data.count || fbJobs.length);
        updateStatus('firebase_search', data.message || `🔥 자사 ${fbJobs.length}개`, data.progress || 35);
      }
    }
    else if (data.stage === 'work24_search') {
      if (data.status === 'started') {
        updateStatus('work24_search', data.message || '🌐 외부 검색 중...', data.progress || 40);
      } else if (data.status === 'finished') {
        const w24Jobs = data.jobs || [];
        if (isLoadMore) {
          setWork24Jobs(prev => [...prev, ...w24Jobs]);
        } else {
          setWork24Jobs(w24Jobs);
        }
        setWork24Count(data.count || w24Jobs.length);
        if (data.total !== undefined) setTotalCount(data.total);
        updateStatus('work24_search', data.message || `🌐 외부 ${w24Jobs.length}개`, data.progress || 60);
      }
    }
    else if (data.stage === 'synthesis') {
      if (data.status === 'started') {
        updateStatus('synthesis', data.message || '✨ AI 요약 생성 중...', data.progress || 70);
      } else if (data.status === 'streaming') {
        if (data.partial_answer) {
          setSummaryAnswer(data.partial_answer);
          setActiveTab('summary');
        }
        updateStatus('synthesis', '✨ AI 요약 중...', data.progress || 80);
      } else if (data.status === 'finished') {
        updateStatus('synthesis', '✅ 요약 완료', data.progress || 95);
      }
    }
    else if (data.stage === 'complete') {
      if (data.status === 'success') {
        updateStatus('complete', data.message || '✅ 완료', 100);

        if (data.summary) {
          setSummaryAnswer(data.summary);
          setActiveTab('summary');
        }
        
        if (data.firebase_jobs !== undefined || data.work24_jobs !== undefined) {
          const fbJobs = data.firebase_jobs || [];
          const w24Jobs = data.work24_jobs || [];
          
          if (isLoadMore) {
            setFirebaseJobs(prev => [...prev, ...fbJobs]);
            setWork24Jobs(prev => [...prev, ...w24Jobs]);
          } else {
            setFirebaseJobs(fbJobs);
            setWork24Jobs(w24Jobs);
          }
          
          setFirebaseCount(data.firebase_count || fbJobs.length);
          setWork24Count(data.work24_count || w24Jobs.length);
        }
        
        if (data.page) setCurrentPage(data.page);
        if (data.has_more !== undefined) {
          setHasMore(data.has_more);
        }
        if (data.params) setParams(data.params);
        if (data.from_cache) setFromCache(true);
        
        setLoading(false);
        setLoadingMore(false);
      }
    }
    else if (data.stage === 'error' || data.error) {
      setError(data.error || '알 수 없는 오류');
      updateStatus('error', '오류 발생', 0);
      setLoading(false);
      setLoadingMore(false);
    }
  }, [updateStatus]);

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
      setTotalCount(0);
      setFromCache(false);
      setFirebaseJobs([]);
      setWork24Jobs([]);
      setFirebaseCount(0);
      setWork24Count(0);
      setActiveFilter('all');
      setCurrentPage(1);
      setHasMore(false);
    }
    
    updateStatus('started', '검색 시작...', 5);
    abortControllerRef.current = new AbortController();

    try {
      // 사용자의 지역 정보 가져오기
      const userSubRegion = currentUser?.subRegion;
      const hasRegion = hasRegionInQuery(query.trim());
      
      const requestBody: any = { 
        query: query.trim(),
        page: page,
        per_page: 15
      };

      // 검색어에 지역 정보가 없고 사용자에게 저장된 지역 정보가 있으면 추가
      if (userSubRegion && !hasRegion) {
        requestBody.region = userSubRegion;
      }

      if (!API_URL) {
        throw new Error("API URL이 설정되지 않았습니다. NEXT_PUBLIC_AIJOB_API_BASE 환경 변수를 확인해주세요.");
      }

      const response = await fetch(API_URL, {
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith('data:')) {
            const jsonStr = line.substring(5).trim();
            if (!jsonStr || jsonStr.length < 2) continue;

            let data;
            try {
              data = JSON.parse(jsonStr);
            } catch {
              console.warn('JSON 파싱 실패:', jsonStr);
              continue;
            }

            processSSEData(data, isLoadMore);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.log('요청 취소됨');
        return;
      }

      const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
      
      if (firebaseJobs.length > 0 || work24Jobs.length > 0) {
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

  const handleApply = (url: string) => {
    if (!url || url === 'https://www.work24.go.kr') {
      alert('채용 페이지 URL이 제공되지 않았습니다.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const fetchJobDetail = async (jobId: string) => {
    setDetailLoading(true);
    try {
      if (!API_BASE) {
        throw new Error("API URL이 설정되지 않았습니다. NEXT_PUBLIC_AIJOB_API_BASE 환경 변수를 확인해주세요.");
      }
      const response = await fetch(`${API_BASE}/detail/${jobId}`);
      if (!response.ok) {
        throw new Error('상세 정보를 불러올 수 없습니다');
      }
      const data = await response.json();
      setSelectedJob(data);
    } catch (err) {
      console.error('상세 정보 조회 실패:', err);
      alert('상세 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const SEARCH_CACHE_KEY = 'jobSearchState';

// 페이지 로드 시 저장된 상태 복원
useEffect(() => {
  const savedState = sessionStorage.getItem(SEARCH_CACHE_KEY);
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      // 상태 복원
      setQuery(parsed.query || '');
      setFirebaseJobs(parsed.firebaseJobs || []);
      setWork24Jobs(parsed.work24Jobs || []);
      setFirebaseCount(parsed.firebaseCount || 0);
      setWork24Count(parsed.work24Count || 0);
      setParams(parsed.params || null);
      setSummaryAnswer(parsed.summaryAnswer || '');
      setTotalCount(parsed.totalCount || 0);
      setCurrentPage(parsed.currentPage || 1);
      setHasMore(parsed.hasMore || false);
      setFromCache(parsed.fromCache || false);
      
      // 결과가 있으면 jobs 탭으로 설정
      if (parsed.firebaseJobs?.length > 0 || parsed.work24Jobs?.length > 0) {
        setActiveTab('jobs');
      }
    } catch (e) {
      console.error('저장된 검색 상태 복원 실패:', e);
    }
  }
}, []);

// 검색 상태가 변경될 때마다 저장
useEffect(() => {
  if (query && (firebaseJobs.length > 0 || work24Jobs.length > 0)) {
    const stateToSave = {
      query,
      firebaseJobs,
      work24Jobs,
      firebaseCount,
      work24Count,
      params,
      summaryAnswer,
      totalCount,
      currentPage,
      hasMore,
      fromCache,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(stateToSave));
  }
}, [query, firebaseJobs, work24Jobs, firebaseCount, work24Count, params, summaryAnswer, totalCount, currentPage, hasMore, fromCache]);

  const handleJobClick = (job: Job) => {
  const isFirebase = job.source === 'firebase' || job.id.startsWith('firebase_');
  
  if (isFirebase) {
    // 현재 상태를 저장한 후 이동
    const currentState = {
      query,
      firebaseJobs,
      work24Jobs,
      firebaseCount,
      work24Count,
      params,
      summaryAnswer,
      totalCount,
      currentPage,
      hasMore,
      fromCache,
      activeTab,
      activeFilter,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(currentState));
    
    const jobId = job.id.replace('firebase_', '');
    window.location.href = `/jobs/${jobId}`;
  } else {
    fetchJobDetail(job.id);
  }
};

  const closeDetail = () => {
    setSelectedJob(null);
  };

  const handleOptionSelect = (value: 'jobs' | 'talents') => {
    setSearchMode(value);
    setIsDropdownOpen(false);
  };

  const exampleQueries = currentUser?.subRegion ? [
    '신입 백엔드 개발자',  // 지역 없음 - 사용자 지역 자동 적용
    '프론트엔드 React 3년 이상',  // 지역 없음 - 사용자 지역 자동 적용
    '서울 강남 풀스택 개발자',  // 지역 명시 - 서울 강남으로 검색
  ] : [
    '서울 강남 신입 백엔드 개발자',
    '경기 분당 프론트엔드 React 3년 이상', 
    '부산 대기업 주5일 최신 공고',
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
              className="flex items-center justify-center md:justify-start md:gap-3 h-[56px] w-[56px] md:w-auto md:px-6 bg-white border-2 border-gray-300 rounded-2xl hover:border-gray-400 focus:border-blue-500 focus:outline-none md:min-w-[180px] shadow-sm transition-all"
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
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
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
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
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
              placeholder={ // isMounted 확인 후 placeholder 렌더링
                isMounted && currentUser?.subRegion 
                  ? "직무·직업 검색하세요 (지역은 자동으로 설정됩니다)" 
                  : "시·군·구 + 직무·직업 검색하세요"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
              className="w-full pl-14 pr-6 py-4 border-2 border-gray-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:border-blue-500 text-base transition-all placeholder:text-gray-400"
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
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium h-[56px] w-[56px] md:w-auto md:px-8 rounded-2xl  transition disabled:from-gray-400 disabled:to-gray-400 font-semibold shadow-lg"
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
          {isMounted && ( // isMounted 확인 후 예시 쿼리 렌더링
            exampleQueries.map((example) => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition border border-blue-200"
                disabled={loading}
              >
                {example}
              </button>
            ))
          )}
        </div>

        {/* 사용자 지역 정보 표시 */}
        {isMounted && currentUser?.subRegion && ( // isMounted 확인 후 지역 정보 렌더링
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-blue-600 font-semibold">📍 기본 검색 지역:</span>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-medium border border-blue-200">
              {currentUser.subRegion}
            </span>
            <span className="text-gray-500">
              (검색어에 지역명이 없으면 자동 적용됩니다)
            </span>
          </div>
        )}
      </div>

      {/* 나머지 기능들은 원본과 동일 */}
      {/* 로딩 상태 */}
      {loading && (
        <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-8 mb-8 shadow-2xl border-2 border-blue-300">
          <div className="flex items-center gap-4 mb-5">
            <Loader2 className="animate-spin h-9 w-9 text-blue-600" />
            <span className="font-bold text-blue-900 text-2xl">{status.message}</span>
          </div>
          
          <div className="w-full bg-white/70 rounded-full h-5 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-full transition-all duration-500 ease-out shadow-lg"
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
            <Filter className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-gray-900 text-xl">검색 조건</span>
            {fromCache && (
              <span className="ml-2 px-4 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full text-sm font-bold shadow-sm">
                💾 캐시됨
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {params.region && (
              <span className="px-5 py-2.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 rounded-full font-bold shadow-md">
                📍 {REGION_NAMES[params.region] || params.region}
              </span>
            )}
            {params.occupation && params.occupation.length > 0 && (
              <span className="px-5 py-2.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 rounded-full font-bold shadow-md">
                💼 {params.occupation.map(o => OCCUPATION_NAMES[o] || o).join(', ')}
              </span>
            )}
            {params.career && (
              <span className="px-5 py-2.5 bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 rounded-full font-bold shadow-md">
                👤 {CAREER_NAMES[params.career] || params.career}
              </span>
            )}
            {params.empTp && params.empTp.length > 0 && (
              <span className="px-5 py-2.5 bg-gradient-to-r from-green-100 to-green-200 text-green-800 rounded-full font-bold shadow-md">
                📋 {params.empTp.map(e => EMPLOYMENT_NAMES[e] || e).join(', ')}
              </span>
            )}
            {totalCount > 0 && (
              <span className="ml-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-full font-bold shadow-lg text-base">
                총 {totalCount.toLocaleString()}개
              </span>
            )}
          </div>
        </div>
      )}

      {/* 검색 결과 통계 */}
      {(firebaseCount > 0 || work24Count > 0) && (
        <div className="mb-6 bg-white/90 rounded-2xl p-6 border border-gray-200 shadow-lg">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600">{firebaseCount}</div>
              <div className="text-sm text-gray-600 mt-1 font-medium">🔥 자사 채용</div>
            </div>
            <div className="text-3xl text-gray-300">+</div>
            <div>
              <div className="text-4xl font-bold text-indigo-600">{work24Count}</div>
              <div className="text-sm text-gray-600 mt-1 font-medium">🌐 외부 채용</div>
            </div>
            <div className="text-3xl text-gray-300">=</div>
            <div>
              <div className="text-4xl font-bold text-purple-600">{firebaseCount + work24Count}</div>
              <div className="text-sm text-gray-600 mt-1 font-medium">📊 전체</div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      {(summaryAnswer || displayedJobs.length > 0) && (
        <div className="flex gap-6 mb-8 border-b-2 border-gray-300">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-10 py-5 font-bold text-xl transition-all relative ${
              activeTab === 'summary'
                ? 'border-b-4 border-indigo-600 text-indigo-600 -mb-0.5'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI 요약
            </span>
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-10 py-5 font-bold text-xl transition-all relative ${
              activeTab === 'jobs'
                ? 'border-b-4 border-indigo-600 text-indigo-600 -mb-0.5'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              채용공고
              <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
                {displayedJobs.length}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* 필터 버튼 */}
      {(firebaseCount > 0 || work24Count > 0) && activeTab === 'jobs' && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${ 
              activeFilter === 'all'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white border-2 border-gray-300 hover:border-indigo-400'
            }`}
          >
            전체 ({firebaseCount + work24Count})
          </button>
          
          <button
            onClick={() => setActiveFilter('firebase')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeFilter === 'firebase'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-white border-2 border-gray-300 hover:border-blue-400'
            }`}
          >
            🔥 자사만 ({firebaseCount})
          </button>
          
          <button
            onClick={() => setActiveFilter('work24')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              activeFilter === 'work24'
                ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg'
                : 'bg-white border-2 border-gray-300 hover:border-gray-400'
            }`}
          >
            🌐 외부만 ({work24Count})
          </button>
        </div>
      )}

      {/* AI 요약 */}
      {activeTab === 'summary' && summaryAnswer && (
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 mb-8 border border-indigo-200">
          <h2 className="text-4xl font-extrabold mb-8 text-gray-900 flex items-center gap-4">
            <Sparkles className="w-10 h-10 text-yellow-500" />
            AI 맞춤 요약
          </h2>

          <div className="prose prose-xl max-w-none">
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-xl">
              {summaryAnswer}
            </p>
          </div>

          <div className="mt-8 pt-8 border-t-2 border-gray-200">
            <button
              onClick={() => setActiveTab('jobs')}
              className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 font-bold text-lg hover:gap-4 transition-all"
            >
              전체 채용공고 보기 ({displayedJobs.length}개) →
            </button>
          </div>
        </div>
      )}

      {/* 채용공고 리스트 */}
      {activeTab === 'jobs' && displayedJobs.length > 0 && (
        <div className="space-y-4">
          {displayedJobs.map((job) => {
            const isFirebase = job.source === 'firebase' || job.id.startsWith('firebase_');
            const isLiked = savedJobs.has(job.id);
            
            return (
              <div
                key={job.id}
                className={`bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group border ${
                  isFirebase 
                    ? 'border-blue-200 bg-gradient-to-r from-blue-50/50 to-white hover:border-blue-300' 
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
                onClick={() => handleJobClick(job)}
              >
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        {isFirebase ? (
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                            <span className="text-sm">🔥</span>
                            자사
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                            <span className="text-sm">🌐</span>
                            워크넷
                          </span>
                        )}
                        
                        <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-full text-xs font-semibold">
                          {job.employment_type}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(job);
                        }}
                        className={`p-2 rounded-full transition-all hover:scale-110 ${
                          isLiked
                            ? 'bg-pink-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-600 hover:bg-pink-100 hover:text-pink-600'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {job.title}
                      </h3>
                      <p className="text-lg text-gray-700 font-semibold flex items-center gap-2">
                        <span className="text-xl">🏢</span>
                        {job.company}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📍</span>
                        <span className="truncate">{job.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">💰</span>
                        <span className="truncate">{job.salary}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎓</span>
                        <span className="truncate">{job.education}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">💼</span>
                        <span className="truncate">{job.experience}</span>
                      </div>
                    </div>

                    {isFirebase && job.requirements && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                        <p className="text-sm text-gray-700 line-clamp-2">
                          <span className="font-semibold text-blue-900">자격요건:</span> {job.requirements}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-gray-200 mt-auto">
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⏰</span>
                          <span>마감: <strong className="text-gray-900">{job.deadline}</strong></span>
                        </div>
                        {job.reg_date && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>📅</span>
                            <span>{job.reg_date}</span>
                          </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isFirebase) {
                            const jobId = job.id.replace('firebase_', '');
                            window.location.href = `/jobs/${jobId}`;
                          } else {
                            handleApply(job.url);
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold text-sm shadow-md transition-all hover:scale-105"
                      >
                        {isFirebase ? '상세보기' : '지원하기'}
                        <ExternalLink className="w-4 h-4" />
                      </button>
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
                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl hover:from-indigo-700 hover:to-purple-700 font-bold text-lg shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    로딩 중...
                  </>
                ) : (
                  <>
                    더 보기 (15개씩)
                    <span className="text-2xl">⬇️</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 상세 모달 */}
      {selectedJob && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeDetail}
        >
          <div 
            className="bg-white rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex items-center justify-center p-20">
                <Loader2 className="animate-spin h-12 w-12 text-indigo-600" />
              </div>
            ) : (
              <div className="p-10">
                <div className="flex justify-between items-start mb-10 border-b-2 pb-8">
                  <div className="flex-1">
                    <h2 className="text-5xl font-extrabold text-gray-900 mb-6">
                      {selectedJob.job.title}
                    </h2>
                    <div className="flex items-center gap-6 text-2xl text-gray-700 mb-4">
                      <span className="flex items-center gap-3">
                        <span className="text-3xl">🏢</span>
                        {selectedJob.company.name}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={closeDetail}
                    className="text-gray-400 hover:text-gray-600 transition p-2"
                  >
                    <X className="w-10 h-10" />
                  </button>
                </div>

                <div className="flex gap-5 pt-8 border-t-2">
                  {selectedJob.job.detail_url && (
                    <button
                      onClick={() => window.open(selectedJob.job.detail_url, '_blank')}
                      className="flex-1 flex items-center justify-center gap-3 px-10 py-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 font-bold text-2xl shadow-2xl transition-all"
                    >
                      워크넷에서 지원하기
                      <ExternalLink className="w-7 h-7" />
                    </button>
                  )}
                  <button
                    onClick={closeDetail}
                    className="px-10 py-6 bg-gray-200 text-gray-700 rounded-2xl hover:bg-gray-300 font-bold text-2xl transition-all"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}