"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "@/firebase"; // Firebase db 인스턴스 import

// 개인회원 아이디 찾기 스키마
const personalFindIdSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요."),
  phone: z.string().min(10, "올바른 휴대폰 번호를 입력해주세요. ('-' 제외)"),
});

// 기업회원 아이디 찾기 스키마
const enterpriseFindIdSchema = z.object({
  businessNumber: z.string().length(10, "사업자등록번호 10자리를 입력해주세요."),
  name: z.string().min(1, "담당자명을 입력해주세요."),
  phone: z.string().min(8, "올바른 휴대폰 번호를 입력해주세요."),
});

const FindIdPage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("personal");
  const [foundId, setFoundId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const personalForm = useForm({
    resolver: zodResolver(personalFindIdSchema),
  });

  const enterpriseForm = useForm({
    resolver: zodResolver(enterpriseFindIdSchema),
  });

  const handlePersonalFindId = async (data) => {
    setLoading(true);
    setError("");
    setFoundId("");

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("displayName", "==", data.name),
        where("phone", "==", data.phone)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          setFoundId(doc.data().email);
        });
      } else {
        setError("일치하는 개인회원 정보를 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("개인회원 아이디 찾기 오류:", err);
      setError("아이디 찾기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnterpriseFindId = async (data) => {
    setLoading(true);
    setError("");
    setFoundId("");

    try {
      const enterpriseRef = collection(db, "enterprise");
      const q = query(
        enterpriseRef,
        where("businessNumber", "==", data.businessNumber),
        where("displayName", "==", data.name),
        where("phone", "==", data.phone)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
          setFoundId(doc.data().email);
        });
      } else {
        setError("일치하는 기업회원 정보를 찾을 수 없습니다.");
      }
    } catch (err) {
      console.error("기업회원 아이디 찾기 오류:", err);
      setError("아이디 찾기 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
          아이디 찾기
        </h1>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 py-3 text-center text-lg font-semibold ${
              activeTab === "personal"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setActiveTab("personal");
              setFoundId("");
              setError("");
            }}
          >
            개인회원
          </button>
          <button
            className={`flex-1 py-3 text-center text-lg font-semibold ${
              activeTab === "enterprise"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setActiveTab("enterprise");
              setFoundId("");
              setError("");
            }}
          >
            기업회원
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {foundId && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-600 text-lg font-bold">찾으신 아이디: {foundId}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              로그인 하러 가기
            </button>
          </div>
        )}

        {/* 개인회원 아이디 찾기 */}
        {activeTab === "personal" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">가입정보로 찾기</h2>
            <form onSubmit={personalForm.handleSubmit(handlePersonalFindId)} className="space-y-4">
             
              <div>
                <input
                  {...personalForm.register("name")}
                  type="text"
                  placeholder="이름을 입력해주세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
                {personalForm.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <input
                  {...personalForm.register("phone")}
                  type="text"
                  placeholder="휴대폰 [- 제외 번호 입력]"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                />
                {personalForm.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{personalForm.formState.errors.phone.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                개인회원 아이디 찾기
              </button>
            </form>
          </div>
        )}

        {/* 기업회원 아이디 찾기 */}
        {activeTab === "enterprise" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800">가입정보로 찾기</h2>
            <form onSubmit={enterpriseForm.handleSubmit(handleEnterpriseFindId)} className="space-y-4">
              <div>
                <input
                  {...enterpriseForm.register("businessNumber")}
                  type="text"
                  placeholder="사업자등록번호 [- 제외 번호 입력]"
                  maxLength={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {enterpriseForm.formState.errors.businessNumber && (
                  <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.businessNumber.message}</p>
                )}
              </div>
              <div>
                <input
                  {...enterpriseForm.register("name")}
                  type="text"
                  placeholder="담당자명"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {enterpriseForm.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <input
                  {...enterpriseForm.register("phone")}
                  type="text"
                  placeholder="휴대폰번호"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {enterpriseForm.formState.errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{enterpriseForm.formState.errors.phone.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                기업회원 아이디 찾기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindIdPage;
