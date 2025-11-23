"use client";

import React, { useState } from 'react';
import JobSearch from './JobSearch';
import TalentSearch from './TalentSearch';

export default function Work24Search() {
  const [searchMode, setSearchMode] = useState<'jobs' | 'talents'>('jobs');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 공통 헤더 */}
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <img src='/Image/logo.png' alt='모두잡AI 로고' className='h-12 w-12' />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              모두잡AI
            </h1>
          </div>
          <p className="text-gray-700 text-xl font-medium tracking-tight leading-relaxed max-w-2xl mx-auto mt-1">
            모두잡AI 채용공고,지원 AI
          </p>
        </div>

        {/* 조건부 렌더링 - 선택된 검색 모드에 따라 컴포넌트 표시 */}
        <div className="transition-all duration-300">
          {searchMode === 'jobs' && (
            <div key="jobs" className="animate-fade-in">
              <JobSearch searchMode={searchMode} setSearchMode={setSearchMode} />
            </div>
          )}
          
          {searchMode === 'talents' && (
            <div key="talents" className="animate-fade-in">
              <TalentSearch searchMode={searchMode} setSearchMode={setSearchMode} />
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}