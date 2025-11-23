"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import app from "@/firebase"; // Firebase app 인스턴스 import

const findPasswordSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요."),
});

const FindPasswordPage = () => {
  const router = useRouter();
  const auth = getAuth(app);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const { register, formState: { errors }, handleSubmit } = useForm({
    resolver: zodResolver(findPasswordSchema),
  });

  const onFindPasswordSubmit = async (data) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, data.email);
      setMessage("비밀번호 재설정 이메일을 보냈습니다. 이메일을 확인해주세요.");
    } catch (err) {
      console.error("비밀번호 재설정 오류:", err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setError("가입되지 않은 이메일 주소이거나 올바른 형식이 아닙니다.");
      } else {
        setError("비밀번호 재설정 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 sm:p-10">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
          비밀번호 찾기
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm font-bold">{message}</p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              로그인 페이지로
            </button>
          </div>
        )}

        <p className="text-gray-700 text-center mb-6">
          가입 시 등록하신 이메일 주소를 입력하시면<br />
          비밀번호 재설정 링크를 보내드립니다.
        </p>

        <form onSubmit={handleSubmit(onFindPasswordSubmit)} className="space-y-4">
          <div>
            <input
              {...register("email")}
              type="email"
              placeholder="가입 시 등록한 이메일 주소"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? '이메일 전송 중...' : '비밀번호 재설정 이메일 보내기'}
          </button>
        </form>

        <div className="flex justify-center mt-6">
          <button
            onClick={() => router.push("/login")}
            className="text-blue-500 hover:underline text-sm"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default FindPasswordPage;
