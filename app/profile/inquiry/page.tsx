'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { MessageCircle, Send, Rocket } from 'lucide-react';
import { useSelector } from 'react-redux';

interface Reply {
  id: string;
  inquiryId: string;
  content: string;
  email: string;
  createdAt: any;
}

interface Inquiry {
  id: string;
  content: string;
  email: string;
  createdAt: any;
  status: string;
}

export default function InquiryPage() {
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [replies, setReplies] = useState<{ [key: string]: Reply[] }>({});
  const [replyContent, setReplyContent] = useState('');
  const [showReplyForm, setShowReplyForm] = useState<string | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const { currentUser } = useSelector((state: any) => state.user);

  useEffect(() => {
    const q = query(
      collection(db, 'inquiries'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inquiriesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Inquiry[];
      setInquiries(inquiriesList);

      // 각 문의에 대한 답글 가져오기
      inquiriesList.forEach(inquiry => {
        const replyQuery = query(
          collection(db, 'replies'),
          where('inquiryId', '==', inquiry.id),
          orderBy('createdAt', 'asc')
        );

        onSnapshot(replyQuery, (replySnapshot) => {
          const replyList = replySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Reply[];

          setReplies(prev => ({
            ...prev,
            [inquiry.id]: replyList
          }));
        });
      });
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content || !email) {
      alert('이메일과 문의 내용을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const inquiryData = {
        content: content.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(db, 'inquiries'), inquiryData);

      setSubmitMessage('문의가 성공적으로 등록되었습니다.');
      setContent('');
      setEmail('');
    } catch (error) {
      console.error('문의 제출 중 오류:', error);
      setSubmitMessage('문의 등록 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (inquiryId: string) => {
    if (!currentUser) {
      alert('답글을 작성하려면 로그인이 필요합니다.');
      return;
    }

    if (!replyContent) {
      alert('답글 내용을 입력해주세요.');
      return;
    }

    setIsSubmittingReply(true);
    try {
      const replyData = {
        inquiryId,
        content: replyContent.trim(),
        email: currentUser.email,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'replies'), replyData);

      setReplyContent('');
      setShowReplyForm(null);
    } catch (error) {
      console.error('답글 제출 중 오류:', error);
      alert('답글 등록 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  function formatDate(timestamp: any) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  if (!currentUser) {
    return (
      <div className="flex-1 md:p-6 py-6 overflow-auto">
        <div className="px-2 md:px-0">
          <div className="bg-[#2A4D45]/60 backdrop-blur-sm border border-[#358f80]/30 rounded-xl p-6 text-center">
            <h2 className="text-xl font-semibold text-white mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-400">문의 기능을 사용하려면 로그인해주세요.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 md:p-6 py-6 overflow-auto">
      <div className="px-2 md:px-0 space-y-6">
        {/* 헤더 */}
        <div className="bg-[#2A4D45]/60 backdrop-blur-sm border border-[#358f80]/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Rocket className="w-8 h-8 text-orange-400" />
            <h1 className="text-2xl font-bold text-white">문의</h1>
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-6 text-center">말씀, 감사합니다.</h2>
          
          {submitMessage && (
            <div className="mb-6 p-4 rounded-lg bg-blue-500/20 text-white text-center">
              {submitMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#1a3a33]/60 border border-[#358f80]/30 text-white placeholder-gray-400 focus:outline-none focus:border-[#56ab91] transition-colors"
                placeholder="이메일을 입력해주세요"
                required
              />
            </div>

            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#1a3a33]/60 border border-[#358f80]/30 text-white placeholder-gray-400 focus:outline-none focus:border-[#56ab91] transition-colors min-h-[120px] resize-none"
                placeholder="의견 작성해 주세요"
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-[#56ab91] hover:bg-[#4a9b7f] text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? '등록 중...' : '등록하기'}
              </button>
              <a
                href="http://pf.kakao.com/_pGNPn/chat"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-xl transition-colors"
              >
                카톡문의
              </a>
            </div>
          </form>
        </div>

        {/* 문의 목록 */}
        <div className="space-y-4">
          {inquiries.map((inquiry) => (
            <div
              key={inquiry.id}
              className="bg-[#2A4D45]/60 backdrop-blur-sm border border-[#358f80]/30 rounded-xl p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="text-white/70 text-sm font-medium">
                  {inquiry.email.split('@')[0]}
                </div>
                <div className="text-white/50 text-xs">
                  {formatDate(inquiry.createdAt)}
                </div>
              </div>
              <p className="text-white whitespace-pre-wrap mb-4 leading-relaxed">{inquiry.content}</p>
              
              {/* 답글 목록 */}
              {replies[inquiry.id]?.length > 0 && (
                <div className="mt-4 space-y-3 pl-4 border-l-2 border-[#56ab91]/30">
                  {replies[inquiry.id].map((reply) => (
                    <div key={reply.id} className="bg-[#56ab91]/10 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-[#56ab91] text-sm font-medium">
                          {reply.email.split('@')[0]}
                        </div>
                        <div className="text-[#56ab91]/50 text-xs">
                          {formatDate(reply.createdAt)}
                        </div>
                      </div>
                      <p className="text-white whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 답글 작성 버튼 */}
              <div className="mt-4 flex items-center gap-2">
                {currentUser ? (
                  <button
                    onClick={() => setShowReplyForm(showReplyForm === inquiry.id ? null : inquiry.id)}
                    className="flex items-center gap-2 text-sm text-[#56ab91] hover:text-[#4a9b7f] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    답글 달기
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">답글을 작성하려면 로그인이 필요합니다.</span>
                )}
              </div>

              {/* 답글 작성 폼 */}
              {showReplyForm === inquiry.id && currentUser && (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-[#1a3a33]/60 border border-[#358f80]/30 text-white placeholder-gray-400 focus:outline-none focus:border-[#56ab91] transition-colors"
                      placeholder="답글을 입력하세요"
                      required
                    />
                    <button
                      onClick={() => handleReplySubmit(inquiry.id)}
                      disabled={isSubmittingReply}
                      className="px-4 py-2 bg-[#56ab91] hover:bg-[#4a9b7f] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {isSubmittingReply ? '등록 중...' : '등록'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}