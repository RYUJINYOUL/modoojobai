"use client";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSignup } from "../lib/Usesignup";
import { countries, visas } from '@/lib/region';
import TermsAgreement from "./TermsAgreement";

// 스키마 정의
const personalSignupSchema = z.object({
  userType: z.enum(["domestic", "foreign"]),
  name: z.string().min(2, "이름을 입력해주세요"),
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  passwordConfirm: z.string(),
  phone: z.string().min(10, "올바른 전화번호를 입력해주세요"),
  birthdate: z.string().min(8, "생년월일을 입력해주세요"),
  gender: z.enum(["male", "female"], { required_error: "성별을 선택해주세요" }),
  country: z.string().optional(),
  visa: z.string().optional(),
}).refine(data => data.password === data.passwordConfirm, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["passwordConfirm"],
}).superRefine((data, ctx) => {
  if (data.userType === "foreign") {
    if (!data.country || data.country === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "국적을 선택해주세요.",
        path: ["country"],
      });
    }
    if (!data.visa || data.visa === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "비자 종류를 선택해주세요.",
        path: ["visa"],
      });
    }
  }
});

const socialSignupSchema = z.object({
  userType: z.enum(["domestic", "foreign"]),
  name: z.string().min(2, "이름을 입력해주세요"),
  email: z.string().email("올바른 이메일을 입력해주세요").or(z.literal('')), // ✅ 빈 문자열 허용
  phone: z.string().min(10, "올바른 전화번호를 입력해주세요"),
  birthdate: z.string().min(8, "생년월일을 입력해주세요"),
  gender: z.enum(["male", "female"], { required_error: "성별을 선택해주세요" }),
  country: z.string().optional(),
  visa: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.userType === "foreign") {
    if (!data.country || data.country === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "국적을 선택해주세요.",
        path: ["country"],
      });
    }
    if (!data.visa || data.visa === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "비자 종류를 선택해주세요.",
        path: ["visa"],
      });
    }
  }
});

const enterpriseSignupSchema = z.object({
  name: z.string().min(2, "담당자 이름을 입력해주세요"),
  companyName: z.string().min(2, "회사명을 입력해주세요"),
  businessNumber: z.string().length(10, "사업자등록번호 10자리를 입력해주세요"),
  phone: z.string().min(8, "올바른 연락처를 입력해주세요"), // ✅ 최소 길이를 8로 변경하여 일반 전화번호 허용
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(6, "비밀번호는 6자 이상이어야 합니다"),
  passwordConfirm: z.string(),
}).refine(data => data.password === data.passwordConfirm, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["passwordConfirm"],
});

// 개인 회원가입 폼 컴포넌트
const PersonalSignupForm = ({
  goToStep,
  error,
  personalForm,
  onPersonalSubmit,
  userType,
  setUserType,
  allChecked,
  handleAllCheck,
  checks,
  handleCheck,
  showPassword,
  setShowPassword,
  countries,
  visas,
  sendPhoneVerification,
  phoneLoading,
  isPhoneVerified,
  phoneVerificationCode,
  setPhoneVerificationCode,
  verifyPhoneCode,
  handleGetCurrentLocation,
  isGettingLocation,
  handleAddressSearch,
  addressData,
  setAddressData,
  isEssentialAgreed,
  loading,
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
    <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 sm:p-10">
      <div className="flex items-center mb-6">
        <button
          onClick={() => goToStep('selection')}
          className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-extrabold text-gray-900">개인회원가입</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={personalForm.handleSubmit(onPersonalSubmit)} className="space-y-6">
        
        {/* 내/외국인 선택 */}
        <div className="flex justify-center bg-gray-100 rounded-lg p-1 mb-8">
          <button 
            type="button" 
            onClick={() => {
              setUserType("domestic");
              personalForm.setValue("userType", "domestic", { shouldValidate: true });
            }}
            className={`flex-1 py-3 rounded-md font-bold transition-all ${userType === "domestic" ? "bg-white shadow-md text-indigo-600" : "text-gray-600"}`}
          >
            내국인
          </button>
          <button 
            type="button" 
            onClick={() => {
              setUserType("foreign");
              personalForm.setValue("userType", "foreign", { shouldValidate: true });
            }}
            className={`flex-1 py-3 rounded-md font-bold transition-all ${userType === "foreign" ? "bg-white shadow-md text-indigo-600" : "text-gray-600"}`}
          >
            외국인
          </button>
        </div>

        {/* 이용약관 전체 동의 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <TermsAgreement 
            allChecked={allChecked} 
            handleAllCheck={handleAllCheck} 
            checks={checks} 
            handleCheck={handleCheck} 
          />
        </div>

        {/* 입력 폼 섹션 */}
        <div className="space-y-5">
          
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <input
              {...personalForm.register("name")}
              type="text"
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {personalForm.formState.errors.name && (
              <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.name.message}</p>
            )}
          </div>

          {/* 생년월일 & 성별 */}
          <div className="flex space-x-4">
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">생년월일 <span className="text-xs text-gray-500">(8자리)</span></label>
              <input
                {...personalForm.register("birthdate")}
                type="text"
                placeholder="예: 19900101"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {personalForm.formState.errors.birthdate && (
                <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.birthdate.message}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">성별</label>
              <select
                {...personalForm.register("gender")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">선택</option>
                <option value="male">남자</option>
                <option value="female">여자</option>
              </select>
              {personalForm.formState.errors.gender && (
                <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.gender.message}</p>
              )}
            </div>
          </div>

          {/* 외국인 전용 필드 */}
          {userType === "foreign" && (
            <div className="space-y-5 border-t pt-5 mt-5">
              <div className="grid grid-cols-2 gap-4">
                {/* 국적 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">국적</label>
                  <select
                    {...personalForm.register("country")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">국적 선택</option>
                    {countries.map(country => (
                      <option key={country.value} value={country.value}>{country.label}</option>
                    ))}
                  </select>
                  {personalForm.formState.errors.country && (
                    <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.country.message}</p>
                  )}
                </div>
                
                {/* 비자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">비자</label>
                  <select
                    {...personalForm.register("visa")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">비자 선택</option>
                    {visas.map(visa => (
                      <option key={visa.value} value={visa.value}>{visa.label}</option>
                    ))}
                  </select>
                  {personalForm.formState.errors.visa && (
                    <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.visa.message}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * 비자 종류별 취업 가능 업종이 상이하므로 지원 시 유의하시기 바랍니다.
              </p>
            </div>
          )}
          
          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input
              {...personalForm.register("email")}
              type="email"
              placeholder="example@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {personalForm.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.email.message}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <div className="relative">
              <input
                {...personalForm.register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(prev => !prev)} 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {personalForm.formState.errors.password && (
              <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.password.message}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
            <input
              {...personalForm.register("passwordConfirm")}
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {personalForm.formState.errors.passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.passwordConfirm.message}</p>
            )}
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">휴대폰</label>
            <div className="flex space-x-2">
              <input
                {...personalForm.register("phone")}
                type="tel"
                placeholder="'-' 없이 입력하세요"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => sendPhoneVerification(personalForm.watch("phone"))}
                disabled={phoneLoading || isPhoneVerified}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isPhoneVerified ? '인증완료' : phoneLoading ? '발송중...' : '인증번호 요청'}
              </button>
            </div>
            {personalForm.formState.errors.phone && (
              <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.phone.message}</p>
            )}
          </div>

          {/* 인증번호 입력 */}
          {!isPhoneVerified && (
            <div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={phoneVerificationCode}
                  onChange={(e) => setPhoneVerificationCode(e.target.value)}
                  placeholder="인증번호"
                  maxLength={6}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => verifyPhoneCode(phoneVerificationCode)}
                  disabled={phoneLoading}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {phoneLoading ? '확인중...' : '확인'}
                </button>
              </div>
            </div>
          )}

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {isGettingLocation ? '위치 확인중...' : '현재위치'}
                </button>
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  주소검색
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={addressData.address}
                  readOnly
                  placeholder="주소를 선택해주세요"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                />
                <input
                  type="text"
                  placeholder="상세주소"
                  value={addressData.detail || ''}
                  onChange={(e) => setAddressData(prev => ({ ...prev, detail: e.target.value }))}
                  className="flex-1 sm:w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

        </div>

        <button
          type="submit"
          className="w-full mt-10 h-14 text-lg font-bold bg-yellow-400 hover:bg-yellow-500 text-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded-lg"
          disabled={!isEssentialAgreed || loading || !isPhoneVerified || !addressData.address}
        >
          {loading ? '가입 중...' : '가입하기'}
        </button>
      </form>

      {/* ❌ 여기서 제거 - recaptcha-container */}
    </div>
  </div>
);

// 소셜 회원가입 폼 컴포넌트
const SocialSignupForm = ({
  goToStep,
  error,
  socialForm,
  onSocialSubmit,
  allChecked,
  handleAllCheck,
  checks,
  handleCheck,
  countries,
  visas,
  sendPhoneVerification,
  phoneLoading,
  isPhoneVerified,
  phoneVerificationCode,
  setPhoneVerificationCode,
  verifyPhoneCode,
  handleGetCurrentLocation,
  isGettingLocation,
  handleAddressSearch,
  addressData,
  setAddressData,
  isEssentialAgreed,
  loading,
  socialUserData,
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
    <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 sm:p-10">
      <div className="flex items-center mb-6">
        <button
          onClick={() => goToStep('selection')}
          className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-extrabold text-gray-900">개인회원가입</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={socialForm.handleSubmit(onSocialSubmit)} className="space-y-6">
        {/* 내/외국인 선택 */}
        <div className="flex justify-center bg-gray-100 rounded-lg p-1 mb-8">
          <button
            type="button"
            onClick={() => {
              socialForm.setValue("userType", "domestic", { shouldValidate: true });
            }}
            className={`flex-1 py-3 rounded-md font-bold transition-all ${socialForm.watch("userType") === "domestic" ? "bg-white shadow-md text-indigo-600" : "text-gray-600"}`}
          >
            내국인
          </button>
          <button
            type="button"
            onClick={() => {
              socialForm.setValue("userType", "foreign", { shouldValidate: true });
            }}
            className={`flex-1 py-3 rounded-md font-bold transition-all ${socialForm.watch("userType") === "foreign" ? "bg-white shadow-md text-indigo-600" : "text-gray-600"}`}
          >
            외국인
          </button>
        </div>

        {/* 이용약관 전체 동의 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <TermsAgreement
            allChecked={allChecked}
            handleAllCheck={handleAllCheck}
            checks={checks}
            handleCheck={handleCheck}
          />
        </div>

        {/* 입력 폼 섹션 */}
        <div className="space-y-5">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <input
              {...socialForm.register("name")}
              type="text"
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {socialForm.formState.errors.name && (
              <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.name.message}</p>
            )}
          </div>

          {/* 생년월일 & 성별 */}
          <div className="flex space-x-4">
            <div className="flex-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">생년월일 <span className="text-xs text-gray-500">(8자리)</span></label>
              <input
                {...socialForm.register("birthdate")}
                type="text"
                placeholder="예: 19900101"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {socialForm.formState.errors.birthdate && (
                <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.birthdate.message}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">성별</label>
              <select
                {...socialForm.register("gender")}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">선택</option>
                <option value="male">남자</option>
                <option value="female">여자</option>
              </select>
              {socialForm.formState.errors.gender && (
                <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.gender.message}</p>
              )}
            </div>
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 {!socialUserData?.email && <span className="text-xs text-gray-500">(선택사항)</span>}
            </label>
            <input
              {...socialForm.register("email")}
              type="email"
              placeholder={socialUserData?.email ? socialUserData.email : "example@email.com"}
              disabled={!!socialUserData?.email} // ✅ 이메일이 있으면 수정 불가
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${socialUserData?.email ? 'bg-gray-100' : ''}`}
            />
            {socialForm.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.email.message}</p>
            )}
            {!socialUserData?.email && (
              <p className="text-xs text-gray-500 mt-1">
                * 카카오 계정에서 이메일 정보를 제공받지 못했습니다. 이메일을 입력해주세요.
              </p>
            )}
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">휴대폰</label>
            <div className="flex space-x-2">
              <input
                {...socialForm.register("phone")}
                type="tel"
                placeholder="'-' 없이 입력하세요"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => sendPhoneVerification(socialForm.watch("phone"))}
                disabled={phoneLoading || isPhoneVerified}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isPhoneVerified ? '인증완료' : phoneLoading ? '발송중...' : '인증번호 요청'}
              </button>
            </div>
            {socialForm.formState.errors.phone && (
              <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.phone.message}</p>
            )}
          </div>

          {/* 인증번호 입력 */}
          {!isPhoneVerified && (
            <div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={phoneVerificationCode}
                  onChange={(e) => setPhoneVerificationCode(e.target.value)}
                  placeholder="인증번호"
                  maxLength={6}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => verifyPhoneCode(phoneVerificationCode)}
                  disabled={phoneLoading}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {phoneLoading ? '확인중...' : '확인'}
                </button>
              </div>
            </div>
          )}

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">주소</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {isGettingLocation ? '위치 확인중...' : '현재위치'}
                </button>
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  주소검색
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={addressData.address}
                  readOnly
                  placeholder="주소를 선택해주세요"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                />
                <input
                  type="text"
                  placeholder="상세주소"
                  value={addressData.detail || ''}
                  onChange={(e) => setAddressData(prev => ({ ...prev, detail: e.target.value }))}
                  className="flex-1 sm:w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 외국인 전용 필드 */}
          {socialForm.watch("userType") === "foreign" && (
            <div className="space-y-5 border-t pt-5 mt-5">
              <div className="grid grid-cols-2 gap-4">
                {/* 국적 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">국적</label>
                  <select
                    {...socialForm.register("country")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">국적 선택</option>
                    {countries.map(country => (
                      <option key={country.value} value={country.value}>{country.label}</option>
                    ))}
                  </select>
                  {socialForm.formState.errors.country && (
                    <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.country.message}</p>
                  )}
                </div>

                {/* 비자 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">비자</label>
                  <select
                    {...socialForm.register("visa")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">비자 선택</option>
                    {visas.map(visa => (
                      <option key={visa.value} value={visa.value}>{visa.label}</option>
                    ))}
                  </select>
                  {socialForm.formState.errors.visa && (
                    <p className="text-xs text-red-500 mt-1">{socialForm.formState.errors.visa.message}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * 비자 종류별 취업 가능 업종이 상이하므로 지원 시 유의하시기 바랍니다.
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full mt-10 h-14 text-lg font-bold bg-yellow-400 hover:bg-yellow-500 text-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded-lg"
          disabled={!isEssentialAgreed || loading || !isPhoneVerified || !addressData.address}
        >
          {loading ? '가입 중...' : '가입하기'}
        </button>
      </form>
    </div>
  </div>
);

const EnterpriseSignupForm = ({
  goToStep,
  error,
  enterpriseForm,
  onEnterpriseSubmit,
  allChecked,
  handleAllCheck,
  checks,
  handleCheck,
  showPassword,
  setShowPassword,
  sendPhoneVerification,
  phoneLoading,
  isPhoneVerified,
  phoneVerificationCode,
  setPhoneVerificationCode,
  verifyPhoneCode,
  handleGetCurrentLocation,
  isGettingLocation,
  handleAddressSearch,
  addressData,
  setAddressData,
  isEssentialAgreed,
  loading,
  verifyBusinessNumber,
  isBusinessVerified,
  businessLoading,
}) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
    <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 sm:p-10">
      <div className="flex items-center mb-6">
        <button
          onClick={() => goToStep('selection')}
          className="mr-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-3xl font-extrabold text-gray-900">기업회원가입</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={enterpriseForm.handleSubmit(onEnterpriseSubmit)} className="space-y-6">
        
        {/* 이용약관 전체 동의 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <TermsAgreement 
            allChecked={allChecked} 
            handleAllCheck={handleAllCheck} 
            checks={checks} 
            handleCheck={handleCheck} 
          />
        </div>

        {/* 입력 폼 섹션 */}
        <div className="space-y-5">
          
          {/* 회사명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">회사명</label>
            <input
              {...enterpriseForm.register("companyName")}
              type="text"
              placeholder="회사명을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {enterpriseForm.formState.errors.companyName && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.companyName.message}</p>
            )}
          </div>

          {/* 담당자 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">담당자 이름</label>
            <input
              {...enterpriseForm.register("name")}
              type="text"
              placeholder="담당자 이름을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {enterpriseForm.formState.errors.name && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.name.message}</p>
            )}
          </div>

          {/* 사업자등록번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사업자등록번호</label>
            <div className="flex space-x-2">
              <input
                {...enterpriseForm.register("businessNumber")}
                type="text"
                placeholder="10자리 숫자 (하이픈 제외)"
                maxLength={10}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={async () => {
                  const isValid = await enterpriseForm.trigger(["businessNumber"]); // ✅ 사업자등록번호만 검사
                  if (isValid) {
                    verifyBusinessNumber(enterpriseForm.getValues("businessNumber"));
                  }
                }}
                disabled={businessLoading || isBusinessVerified}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {isBusinessVerified ? '인증완료' : businessLoading ? '확인중...' : '사업자 인증'}
              </button>
            </div>
            {enterpriseForm.formState.errors.businessNumber && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.businessNumber.message}</p>
            )}
          </div>

          
          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input
              {...enterpriseForm.register("email")}
              type="email"
              placeholder="example@company.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {enterpriseForm.formState.errors.email && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.email.message}</p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <div className="relative">
              <input
                {...enterpriseForm.register("password")}
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(prev => !prev)} 
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {enterpriseForm.formState.errors.password && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.password.message}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
            <input
              {...enterpriseForm.register("passwordConfirm")}
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {enterpriseForm.formState.errors.passwordConfirm && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.passwordConfirm.message}</p>
            )}
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">연락처</label>
            <input
              {...enterpriseForm.register("phone")}
              type="tel"
              placeholder="연락 가능한 전화번호를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {enterpriseForm.formState.errors.phone && (
              <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.phone.message}</p>
            )}
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사업장 주소</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors whitespace-nowrap"
                >
                  {isGettingLocation ? '위치 확인중...' : '현재위치'}
                </button>
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  주소검색
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={addressData.address}
                  readOnly
                  placeholder="주소를 선택해주세요"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                />
                <input
                  type="text"
                  placeholder="상세주소"
                  value={addressData.detail || ''}
                  onChange={(e) => setAddressData(prev => ({ ...prev, detail: e.target.value }))}
                  className="flex-1 sm:w-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

        </div>

        <button
          type="submit"
          className="w-full mt-10 h-14 text-lg font-bold bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors rounded-lg"
          disabled={!isEssentialAgreed || loading || !addressData.address || !isBusinessVerified}
        >
          {loading ? '가입 중...' : '가입하기'}
        </button>
      </form>
    </div>
  </div>
);

const CompleteSignupPage = () => {
  const {
    currentStep,
    signupMethod,
    loading,
    error,
    phoneVerificationCode,
    isPhoneVerified,
    phoneLoading,
    isGettingLocation,
    addressData,
    setAddressData,
    socialUserData,
    setPhoneVerificationCode,
    selectSignupMethod,
    goToStep,
    resetSignup,
    handleGetCurrentLocation,
    handleAddressSearch,
    sendPhoneVerification,
    verifyPhoneCode,
    handleGoogleLogin,
    handleKakaoLogin,
    handleAppleLogin,
    completePersonalSignup,
    completeSocialSignup,
    verifyBusinessNumber,
    completeEnterpriseSignup,
  } = useSignup();

  // 기업 회원 관련 상태
  const [isBusinessVerified, setIsBusinessVerified] = useState(false);
  const [businessLoading, setBusinessLoading] = useState(false);

  // 약관 동의 상태
  const [allChecked, setAllChecked] = useState(false);
  const [checks, setChecks] = useState({
    age: false,
    terms: false,
    privacy1: false,
    privacy2: false,
    marketing1: false,
    marketing2: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState("domestic");

  const personalForm = useForm({
    resolver: zodResolver(personalSignupSchema),
    defaultValues: {
      userType: "domestic",
    }
  });

  const socialForm = useForm({
    resolver: zodResolver(socialSignupSchema),
    defaultValues: {
      name: socialUserData?.name || '',
      email: socialUserData?.email || '',
      userType: socialUserData?.provider === 'kakao' || socialUserData?.provider === 'google' ? "domestic" : "", // 소셜 로그인 기본값은 내국인으로 설정
      birthdate: '',
      gender: '',
      country: '',
      visa: '',
    }
  });

  const enterpriseForm = useForm({
    resolver: zodResolver(enterpriseSignupSchema),
    defaultValues: {
      name: '',
      companyName: '',
      businessNumber: '',
      startDt: '',
      email: '',
      password: '',
      passwordConfirm: '',
      phone: '',
    }
  });


  useEffect(() => {
        if (socialUserData?.name && socialUserData?.email) {
            // 소셜 데이터가 채워지면 폼 전체를 리셋하여 새 값을 주입합니다.
            socialForm.reset({
                name: socialUserData.name,
                email: socialUserData.email,
                userType: socialUserData?.provider === 'kakao' || socialUserData?.provider === 'google' ? "domestic" : "", // 소셜 로그인 기본값은 내국인으로 설정
                phone: '', // 전화번호 초기화
                birthdate: '', // 생년월일 초기화
                gender: '', // 성별 초기화
                country: '', // 국적 초기화
                visa: '', // 비자 초기화
            });
        } else {
          // socialUserData가 없으면 폼 필드를 비웁니다. (뒤로가기 시 필드 초기화)
          socialForm.reset({
            name: '',
            email: '',
            userType: "domestic",
            phone: '',
            birthdate: '',
            gender: '',
            country: '',
            visa: '',
          });
        }
    }, [socialUserData, socialForm.reset]);

  // 약관 체크 핸들러
  const handleCheck = (key) => {
    setChecks(prev => {
      const newChecks = { ...prev, [key]: !prev[key] };
      const required = newChecks.age && newChecks.terms && newChecks.privacy1;
      const all = required && newChecks.privacy2 && newChecks.marketing1 && newChecks.marketing2;
      setAllChecked(all);
      return newChecks;
    });
  };

  const handleAllCheck = () => {
    const next = !allChecked;
    setAllChecked(next);
    setChecks({
      age: next,
      terms: next,
      privacy1: next,
      privacy2: next,
      marketing1: next,
      marketing2: next,
    });
  };

  const isEssentialAgreed = checks.age && checks.terms && checks.privacy1;

  // 개인 회원가입 폼 제출
  const onPersonalSubmit = async (data) => {
    if (!isEssentialAgreed) {
      alert("⚠️ 필수 약관에 동의해주세요.");
      return;
    }
    await completePersonalSignup(data);
  };

  // 소셜 회원가입 폼 제출
  const onSocialSubmit = async (data) => {
    if (!isEssentialAgreed) {
      alert("⚠️ 필수 약관에 동의해주세요.");
      return;
    }
    await completeSocialSignup(data);
  };

  // 기업 회원가입 폼 제출
  const onEnterpriseSubmit = async (data) => {
    if (!isEssentialAgreed) {
      alert("⚠️ 필수 약관에 동의해주세요.");
      return;
    }
    if (!isBusinessVerified) {
      alert("⚠️ 사업자등록번호 인증을 완료해주세요.");
      return;
    }
    await completeEnterpriseSignup(data);
  };

  // 사업자 인증 핸들러
  const handleBusinessVerification = async (businessNumber) => {
    setBusinessLoading(true);
    const result = await verifyBusinessNumber(businessNumber);
    if (result) {
      setIsBusinessVerified(true);
    }
    setBusinessLoading(false);
  };

  // 선택 화면
  const SelectionScreen = ({ goToStep, selectSignupMethod }) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-800">
          모두잡AI 회원가입을 환영합니다.
        </h1>
        
        {/* 개인 회원 */}
        <div className="mb-6">
          <div className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-xl hover:border-yellow-400 transition-colors">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">개인 회원</h3>
            <p className="text-sm text-gray-600 mb-4 text-center">일자리를 찾는 일반인</p>
         
            <button
              onClick={() => selectSignupMethod('personal')}
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold rounded-xl transition-colors"
            >
              이메일로 가입하기
            </button>
             <div className="h-3"/> 
            <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 533.5 544.3">
              <path d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z" fill="#4285f4" />
              <path d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z" fill="#34a853" />
              <path d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z" fill="#fbbc04" />
              <path d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z" fill="#ea4335" />
            </svg>
            <span className="font-medium">구글로 가입하기</span>
            </button>
             <div className="h-3"/> 
            <button
            onClick={handleKakaoLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FEE500">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2.1c-6.1 0-11 3.9-11 8.7 0 3 2 5.6 5 7.1l-1 3.8c-0.1 0.3 0 0.7 0.3 0.9 0.2 0.2 0.4 0.3 0.7 0.3 0.1 0 0.3 0 0.4-0.1l4.6-3.1c0.3 0 0.7 0.1 1 0.1 6.1 0 11-3.9 11-8.7s-4.9-8.7-11-8.7z"/>
            </svg>
            <span className="font-medium">카카오로 가입하기</span>
           </button>
   
          </div>
         
        </div>

        

        {/* 기업 회원 */}
        <div>
          <div className="flex flex-col items-center p-6 border-2 border-gray-200 rounded-xl hover:border-blue-400 transition-colors">
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">기업 회원</h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              인재를 구하는 사장님<br />
              (개인사업자, 사업체 직원 포함)
            </p>
            <button
              onClick={() => {
                goToStep('enterprise');
                selectSignupMethod('enterprise');
              }}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
            >
              기업회원 가입하기
            </button>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            빠르고 간편한 공고등록 문의' '
            <span className="text-blue-500 font-semibold">1899-1651</span>
          </p>
        </div>
      </div>
    </div>
  );

  // ✅ 메인 렌더링 - recaptcha-container를 최상위에 한 번만
  return (
    <>
      {/* ⭐ 최상위에 한 번만 - 절대 리렌더링되지 않음 */}
      <div id="recaptcha-container" style={{ position: 'absolute', top: -9999, left: -9999 }}></div>

      {currentStep === 'selection' && <SelectionScreen goToStep={goToStep} selectSignupMethod={selectSignupMethod} />}
      {currentStep === 'personal' && (
        <PersonalSignupForm
          goToStep={goToStep}
          error={error}
          personalForm={personalForm}
          onPersonalSubmit={onPersonalSubmit}
          userType={userType}
          setUserType={setUserType}
          allChecked={allChecked}
          handleAllCheck={handleAllCheck}
          checks={checks}
          handleCheck={handleCheck}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          countries={countries}
          visas={visas}
          sendPhoneVerification={sendPhoneVerification}
          phoneLoading={phoneLoading}
          isPhoneVerified={isPhoneVerified}
          phoneVerificationCode={phoneVerificationCode}
          setPhoneVerificationCode={setPhoneVerificationCode}
          verifyPhoneCode={verifyPhoneCode}
          handleGetCurrentLocation={handleGetCurrentLocation}
          isGettingLocation={isGettingLocation}
          handleAddressSearch={handleAddressSearch}
          addressData={addressData}
          setAddressData={setAddressData}
          isEssentialAgreed={isEssentialAgreed}
          loading={loading}
        />
      )}
      {currentStep === 'social' && (
        <SocialSignupForm
          goToStep={goToStep}
          error={error}
          socialForm={socialForm}
          onSocialSubmit={onSocialSubmit}
          allChecked={allChecked}
          handleAllCheck={handleAllCheck}
          checks={checks}
          handleCheck={handleCheck}
          countries={countries}
          visas={visas}
          sendPhoneVerification={sendPhoneVerification}
          phoneLoading={phoneLoading}
          isPhoneVerified={isPhoneVerified}
          phoneVerificationCode={phoneVerificationCode}
          setPhoneVerificationCode={setPhoneVerificationCode}
          verifyPhoneCode={verifyPhoneCode}
          handleGetCurrentLocation={handleGetCurrentLocation}
          isGettingLocation={isGettingLocation}
          handleAddressSearch={handleAddressSearch}
          addressData={addressData}
          setAddressData={setAddressData}
          isEssentialAgreed={isEssentialAgreed}
          loading={loading}
          socialUserData={socialUserData}
        />
      )}
      {currentStep === 'enterprise' && (
        <EnterpriseSignupForm
          goToStep={goToStep}
          error={error}
          enterpriseForm={enterpriseForm}
          onEnterpriseSubmit={onEnterpriseSubmit}
          allChecked={allChecked}
          handleAllCheck={handleAllCheck}
          checks={checks}
          handleCheck={handleCheck}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          sendPhoneVerification={sendPhoneVerification}
          phoneLoading={phoneLoading}
          isPhoneVerified={isPhoneVerified}
          phoneVerificationCode={phoneVerificationCode}
          setPhoneVerificationCode={setPhoneVerificationCode}
          verifyPhoneCode={verifyPhoneCode}
          handleGetCurrentLocation={handleGetCurrentLocation}
          isGettingLocation={isGettingLocation}
          handleAddressSearch={handleAddressSearch}
          addressData={addressData}
          setAddressData={setAddressData}
          isEssentialAgreed={isEssentialAgreed}
          loading={loading}
          verifyBusinessNumber={handleBusinessVerification}
          isBusinessVerified={isBusinessVerified}
          businessLoading={businessLoading}
        />
      )}
    </>
  );
};

export default CompleteSignupPage;