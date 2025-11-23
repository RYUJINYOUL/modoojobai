import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const termsContent = {
  terms: {
    title: "제 1 조 (목적)",
    content: "본 약관은 모두잡AI(이하 “회사”)가 운영하는 모두잡AI 온라인 웹사이트를 통하여 직업정보 관련 제반 “서비스”를 제공함에 있어 이용 고객(이하 “회원”)과 “회사”간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다."
  },
  privacy1: {
    title: "개인정보 수집 및 이용 동의 (필수)",
    content: `1. 이용자 식별, 본인인증, 회원서비스 제공을 위해 다음과 같은 정보를 수집하고 있습니다.\n① 모두잡AI 일반 회원가입: (필수) 아이디, 비밀번호, 이름, 이메일, 휴대폰번호\n[외국인 회원 추가정보] (필수) 국적, 비자(발급여부, 발급일, 만료일)\n② 모두잡AI Social계정으로 가입(네이버): (필수) 이용자 식별자, 이름, 이메일주소\n③ 모두잡AI Social계정으로 가입(카카오): (필수) 닉네임, 프로필사진\n④ 모두잡AI Social계정으로 가입(페이스북): (필수) 이름, 프로필 사진\n⑤ 모두잡AI(웹) Social계정으로 가입(애플): (필수) 이용자 식별자, 이름\n\n2. 이력서 관리 및 지원 서비스 제공을 위해 다음과 같은 정보를 수집하고 있습니다.\n(필수) 학력정보, 경력사항, 자기소개서, 성별, 생년월일, 주소, 이메일주소\n모두잡AI 이력서 등록 시 수집하는 개인정보 항목(선택)\n- 사진, 홈페이지, 포토앨범\n- 보훈대상 여부, 고용지원금대상 여부, 병역대상 여부 및 병역정보\n- 보유자격증(발행처/기관, 취득시점)\n- 외국어능력(언어명, 구사능력, 공인시험종류, 점수/등급, 취득시점)\n- 장애여부(장애분류, 장애등급)\n외국인 회원 추가정보(필수)\n- 국적, 비자(발급여부, 발급일, 만료일), 한국어 구사능력\n\n3. 보유 기한 : 회원탈퇴 또는 동의 철회 시 까지\n※ 위와 같이 개인정보의 수집 및 이용에 동의를 거부할 권리가 있으며, 동의를 거부할 경우 서비스 사용에 제한이 있습니다.`
  },
  privacy2: {
    title: "개인정보 수집 및 이용 동의 (선택)",
    content: `1. 이용자 식별, 본인인증, 회원서비스 제공을 위해 다음과 같은 정보를 수집하고 있습니다.\n- (선택) 성별, 생년월일\n① 모두잡AI Social계정으로 가입(네이버): (선택) 아이디, 비밀번호, 별명, 프로필사진, 성별, 생일, 연령대\n② 모두잡AI Social계정으로 가입(카카오): (선택) 아이디, 비밀번호\n③ 모두잡AI Social계정으로 가입(페이스북): (선택) 아이디, 비밀번호\n④ 모두잡AI(웹) Social계정으로 가입(애플): (선택) 아이디, 비밀번호, 소셜ID(이메일)\n\n2. 이력서 관리 및 지원 서비스 제공을 위해 다음과 같은 정보를 수집하고 있습니다.\n-(선택)사진, 홈페이지, 포토앨범, 보훈대상 여부, 고용지원금대상 여부, 병역대상 여부 및 병역정보, 보유자격증(발행처/기관, 취득시점), 외국어능력(언어명, 구사능력, 공인시험종류, 점수/등급, 취득시점), 장애여부(장애분류, 장애등급)\n\n3. 보유 기한 : 회원탈퇴 또는 동의 철회 시 까지\n※ 위와 같이 개인정보의 수집 및 이용에 동의를 거부할 권리가 있으며, 동의를 거부하여도 모두잡AI 서비스를 이용하실 수 있습니다.`
  },
  marketing1: {
    title: "광고성 정보 수집 및 이용 동의 (선택)",
    content: `1. 수집 이용 목적: 뉴스, 이벤트, 소식, 설문, 광고 정보를 전송\n2. 수집하는 개인정보 항목: 휴대전화번호, 이메일\n3. 개인정보 보유 및 이용기간: 회원탈퇴 또는 동의 철회 시\n4. 수신동의 거부 및 철회방법 안내: 본 동의는 거부하실 수 있습니다. 다만 거부 시 동의를 통해 제공 가능한 각종 혜택, 이벤트 안내를 받아 보실 수 없습니다.\n※ 본 수신동의를 철회하고자 할 경우에는 회원정보 수정 페이지에서 수신여부를 변경하실 수 있습니다.`
  },
  marketing2: {
    title: "광고성 정보 수신 동의 (선택)",
    content: `회원이 수집 및 이용에 동의한 개인정보를 알바천국에서 활용하는 것에 동의하며, 해당 개인정보를 활용하여 전자적 전송매체(이메일/SMS 등 다양한 전송매체)를 통해 회원에게 유용한 혜택, 이벤트, 광고 정보를 전송할 수 있습니다.\n※ 광고성 정보 수신 동의를 철회하고자 할 경우에는 회원정보 수정 페이지에서 수신여부를 변경하실 수 있습니다.`
  }
};

const TermsAgreement = ({ allChecked, handleAllCheck, checks, handleCheck }) => {
  return (
    <>
      <div className="flex items-center space-x-3 pb-4 border-b">
        <Checkbox
          id="all"
          checked={allChecked}
          onCheckedChange={handleAllCheck}
          className="w-5 h-5 border-indigo-500 data-[state=checked]:bg-indigo-600"
        />
        <Label htmlFor="all" className="text-lg font-bold text-gray-800">
          이용약관 전체동의
        </Label>
      </div>

      <Accordion type="multiple" className="w-full pt-4">
        <div className="flex items-center space-x-3 text-sm text-gray-600 py-2">
          <Checkbox id="age" checked={checks.age} onCheckedChange={() => handleCheck("age")} className="data-[state=checked]:bg-blue-500" />
          <Label htmlFor="age" className="cursor-pointer">[필수] 만 15세 이상입니다.</Label>
        </div>

        {[
          { id: "terms", label: "[필수] 서비스 이용약관 동의" },
          { id: "privacy1", label: "[필수] 개인정보 수집 및 이용 동의" },
          { id: "privacy2", label: "[선택] 개인정보 수집 및 이용 동의 (이력서 등)" },
          { id: "marketing1", label: "[선택] 광고성 정보 수집 및 이용 동의" },
          { id: "marketing2", label: "[선택] 광고성 정보 수신 동의 (SMS/이메일)" },
        ].map((item) => (
          <AccordionItem key={item.id} value={item.id} className="border-b-0">
            <div className="flex items-center justify-between text-sm text-gray-600 py-2">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id={item.id} 
                  checked={checks[item.id]} 
                  onCheckedChange={() => handleCheck(item.id)} 
                  className={item.label.includes('[필수]') ? "data-[state=checked]:bg-blue-500" : "data-[state=checked]:bg-gray-400"}
                />
                <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
              </div>
              <AccordionTrigger className="text-indigo-600 text-xs font-medium hover:underline p-0">
                약관보기
              </AccordionTrigger>
            </div>
            <AccordionContent>
              <div className="bg-gray-100 p-3 rounded-md mt-2 text-xs text-gray-600 max-h-32 overflow-y-auto">
                <h4 className="font-bold mb-2">{termsContent[item.id].title}</h4>
                <pre className="whitespace-pre-wrap font-sans">
                  {termsContent[item.id].content}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="pt-4">
        <p className="text-xs text-red-500 pt-2">
          * 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있으며 동의 거부 시 필수 동의 항목 미충족으로 회원가입이 불가합니다.
        </p>
      </div>
    </>
  );
};

export default TermsAgreement;