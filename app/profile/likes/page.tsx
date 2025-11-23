'use client';

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux'; 
import { db } from '@/firebase'; 
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Briefcase, ExternalLink, User, Loader2, Trash2, Users } from 'lucide-react';

// 찜 목록 아이템 타입 정의
interface WishListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  deadline: string;
  url: string;
}

interface ProfeLikeItem {
  resumeId: string;
  name: string;
  profileImageUrl: string | null;
  careerSummary: string;
}

export default function LikesPage() {
  const { currentUser } = useSelector((state: any) => state.user);
  const [activeTab, setActiveTab] = useState<'recruits' | 'talents'>('recruits');
  const [recruitLikes, setRecruitLikes] = useState<WishListItem[]>([]);
  const [profeLikes, setProfeLikes] = useState<ProfeLikeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isEnterprise = currentUser?.userType === 'enterprise';

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">로그인이 필요합니다.</p>
      </div>
    );
  }

  // 기업 회원이 아니면 '인재' 탭을 볼 수 없으므로 '채용공고' 탭으로 강제 변경
  useEffect(() => {
    if (!isEnterprise && activeTab === 'talents') {
      setActiveTab('recruits');
    }
  }, [isEnterprise, activeTab]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadData = async () => {
      setLoading(true);

      // 채용공고 찜 목록
      const recruitLikesQuery = query(
        collection(db, "recruitLikes"),
        where("userId", "==", currentUser.uid)
      );
      const unsubscribeRecruits = onSnapshot(recruitLikesQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.data().jobId, ...doc.data() } as WishListItem));
        setRecruitLikes(list);
      }, (error) => console.error("채용 찜 목록 로드 실패:", error));

      // 인재 찜 목록
      const profeLikesQuery = query(
        collection(db, "profeLikes"),
        where("userId", "==", currentUser.uid)
      );
      const unsubscribeProfes = onSnapshot(profeLikesQuery, (snapshot) => {
        const list = snapshot.docs.map(doc => doc.data() as ProfeLikeItem);
        setProfeLikes(list);
      }, (error) => console.error("인재 찜 목록 로드 실패:", error));

      setLoading(false);

      return () => {
        unsubscribeRecruits();
        unsubscribeProfes();
      };
    };

    loadData();
  }, [currentUser?.uid]);

  // 찜 목록에서 아이템 삭제
  const handleRemoveLike = async (id: string, type: 'recruit' | 'profe') => {
    if (!currentUser?.uid) return;

    const collectionName = type === 'recruit' ? 'recruitLikes' : 'profeLikes';
    const docId = `${currentUser.uid}_${id}`;
    const likeRef = doc(db, collectionName, docId);

    try {
      await deleteDoc(likeRef);
    } catch (error) {
      console.error("찜 목록 삭제 실패:", error);
      alert("항목 삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="flex-1 md:p-6 py-6 overflow-auto">
      <div className="px-2 md:px-0">
        <div className="bg-[#2A4D45]/60 backdrop-blur-sm border border-[#358f80]/30 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-200">찜 목록</h1>
            <div className="flex items-center gap-2 bg-[#358f80]/50 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('recruits')}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'recruits' ? 'bg-[#56ab91] text-white' : 'text-gray-300 hover:bg-white/10'
                }`}
              >
                채용공고 ({recruitLikes.length})
              </button>
              {isEnterprise && (
                <button
                  onClick={() => setActiveTab('talents')}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                    activeTab === 'talents' ? 'bg-[#56ab91] text-white' : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  인재 ({profeLikes.length})
                </button>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'recruits' && (
                recruitLikes.length === 0 ? (
                  <div className="text-center py-20">
                    <Briefcase className="w-24 h-24 text-gray-400/50 mx-auto mb-6" />
                    <h2 className="text-xl font-semibold text-white mb-4">찜한 채용공고가 없습니다</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                      관심 있는 채용공고를 찜하고 여기에서 확인하세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recruitLikes.map((item) => (
                      <div key={item.id} className="bg-[#358f80]/30 p-4 rounded-lg flex items-center justify-between gap-4 hover:bg-[#358f80]/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                            <h3 className="text-lg font-semibold text-gray-200 truncate group-hover:text-pink-300 transition-colors">{item.title}</h3>
                            <p className="text-sm text-gray-300 truncate">{item.company}</p>
                            <p className="text-xs text-gray-400 mt-1">마감: {item.deadline || '상시채용'}</p>
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="새 창에서 열기">
                            <ExternalLink className="w-5 h-5" />
                          </a>
                          <button onClick={() => handleRemoveLike(item.id, 'recruit')} className="p-2 text-pink-400 hover:text-white hover:bg-pink-500/50 rounded-full transition-colors" title="찜 목록에서 삭제">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'talents' && (
                profeLikes.length === 0 ? (
                  <div className="text-center py-20">
                    <Users className="w-24 h-24 text-gray-400/50 mx-auto mb-6" />
                    <h2 className="text-xl font-semibold text-white mb-4">찜한 인재가 없습니다</h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                      관심 있는 인재를 찜하고 여기에서 확인하세요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {profeLikes.map((item) => (
                      <div key={item.resumeId} className="bg-[#358f80]/30 p-4 rounded-lg flex items-center justify-between gap-4 hover:bg-[#358f80]/50 transition-colors">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {item.profileImageUrl ? (
                            <img src={item.profileImageUrl} alt={item.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center">
                              <User className="w-6 h-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <a href={`/resume/preview/${item.resumeId}`} target="_blank" rel="noopener noreferrer" className="block group">
                              <h3 className="text-lg font-semibold text-gray-200 truncate group-hover:text-pink-300 transition-colors">{item.name}</h3>
                              <p className="text-sm text-gray-300 truncate">{item.careerSummary}</p>
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`/resume/preview/${item.resumeId}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="새 창에서 열기">
                            <ExternalLink className="w-5 h-5" />
                          </a>
                          <button onClick={() => handleRemoveLike(item.resumeId, 'profe')} className="p-2 text-pink-400 hover:text-white hover:bg-pink-500/50 rounded-full transition-colors" title="찜 목록에서 삭제">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
