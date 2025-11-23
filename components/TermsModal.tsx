// app/components/TermsModal.tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TermsModal({ open, onOpenChange }: TermsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl sm:text-2xl font-extrabold text-center text-gray-800">
            이용약관 및 개인정보 수집·이용 동의
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[70vh] pr-4 border p-4 rounded-lg bg-gray-50">
          <div className="space-y-6 text-sm leading-relaxed text-gray-700">
            <section>
              <h3 className="font-bold text-lg mb-2 text-indigo-600">제 1 조 (목적)</h3>
              <p>본 약관은 모두잡AI(이하 “회사”)가 운영하는 모두잡AI 온라인 웹사이트를 통하여 직업정보 관련 제반 “서비스”를 제공함에 있어 이용 고객(이하 “회원”)과 “회사”간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
            </section>
            
            <section>
              <h3 className="font-bold text-lg mb-2 text-indigo-600">개인정보 수집 및 이용 동의</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-base mb-1">1. 이용자 식별, 본인인증, 회원서비스 제공을 위해 수집하는 정보 (필수/선택 항목)</h4>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong>① 모두잡AI 일반 회원가입</strong><br/>
                      <span className="text-red-500 font-medium">(필수)</span> 아이디, 비밀번호, 이름, 이메일, 휴대폰번호<br/>
                      <span className="text-red-500 font-medium">[외국인 회원 추가정보] (필수)</span> 국적, 비자(발급여부, 발급일, 만료일)
                    </li>
                    <li><strong>② 소셜 로그인</strong> (필수) 이용자 식별자, 이름, 이메일 등 각 플랫폼에서 제공하는 정보</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-base mb-1">2. 이력서 관리 및 지원 서비스 제공을 위해 수집하는 정보 (선택 항목)</h4>
                  <p><span className="text-blue-500 font-medium">(필수 동의 시)</span> 학력정보, 경력사항, 자기소개서, 성별, 생년월일, 주소, 이메일주소</p>
                  <p className="mt-1"><span className="text-blue-500 font-medium">(추가 선택)</span> 사진, 홈페이지, 포토앨범, 보훈/고용지원금/병역 정보, 자격증, 외국어능력, 장애여부 등</p>
                </div>

                <div>
                  <h4 className="font-semibold text-base mb-1">3. 보유 기한</h4>
                  <p>회원탈퇴 또는 동의 철회 시까지</p>
                </div>
              </div>
            </section>
            
            <section>
              <h3 className="font-bold text-lg mb-2 text-indigo-600">광고성 정보 수신 동의 (선택)</h3>
              <p>뉴스, 이벤트, 혜택, 광고 등을 휴대전화번호·이메일로 전송<br/>
                → 동의를 거부해도 서비스 이용에 제한 없습니다.</p>
            </section>

            <p className="text-center font-bold mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              ※ 위와 같이 개인정보의 수집 및 이용에 동의를 거부할 권리가 있으며,<br/>
              <span className="text-red-600">필수 동의 거부 시 서비스 사용에 제한이 있을 수 있습니다.</span>
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}