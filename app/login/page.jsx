"use client";
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useDispatch } from 'react-redux';
import app, { db } from "../../firebase";
import { setUser } from "@/store/userSlice";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { saveFcmToken } from "@/lib/fcm";

// ✅ state=login 추가
const KAKAO_AUTH_URL_LOGIN = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL_PROD}&state=login`;

const LoginPage = () => {
  const auth = getAuth(app);
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm();

  const {
    register: enterpriseRegister,
    formState: { errors: enterpriseErrors },
    handleSubmit: handleEnterpriseSubmit,
  } = useForm(); // ✅ 기업회원 폼 훅 추가

  const [errorFromSubmit, setErrorFromSubmit] = useState("");
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("personal"); // ✅ 탭 상태 추가
  const [rememberId, setRememberId] = useState(false); // ✅ 아이디 저장 상태 추가


  // 페이지 로드 시 저장된 아이디 불러오기
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      register("email", { value: savedEmail });
      setRememberId(true);
    }

    const savedEnterpriseEmail = localStorage.getItem("rememberedEnterpriseEmail");
    if (savedEnterpriseEmail) {
      enterpriseRegister("email", { value: savedEnterpriseEmail });
    }
  }, [register, enterpriseRegister]);

  // 카카오톡 인앱 브라우저 알림
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.userAgent.includes("KAKAOTALK")) {
      alert("Google 로그인이 지원되지 않는 브라우저입니다.\n오른쪽 하단의 [...] 버튼을 눌러 '기본 브라우저로 열기'를 선택해 주세요.");
    }
  }, []);

  // 이메일/비밀번호 로그인
  const onSubmit = async (data) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = result.user;

      // ✅ 아이디 저장 처리
      if (rememberId) {
        localStorage.setItem("rememberedEmail", data.email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // Firestore에서 사용자 정보 가져오기
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      dispatch(setUser({
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        subRegion: userSnap.exists() ? userSnap.data()?.subRegion || '' : ''
      }));

      let fcmToken = null;
      try {
        fcmToken = await saveFcmToken(user.uid);
      } catch (error) {
        console.error("FCM 토큰 저장 실패:", error);
      }

      if (userSnap.exists()) {
        await updateDoc(userRef, {
          fcmToken: fcmToken || null,
          pushTime: serverTimestamp(),
        });
      }
      
      setLoading(false);
      push('/');
    } catch (error) {
      setErrorFromSubmit("가입하지 않은 이메일이거나 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      setTimeout(() => {
        setErrorFromSubmit("");
      }, 5000);
    }
  };

  // ✅ Google 로그인 - 수정된 버전
  const handleGoogleSign = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // ✅ Firestore에서 사용자 정보 확인 (개인회원만 해당)
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.phone) {
        // ✅ 완전한 개인회원 - 로그인 처리
        dispatch(setUser({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          subRegion: userDocSnap.data()?.subRegion || ''
        }));

        let fcmToken = null;
        try {
          fcmToken = await saveFcmToken(user.uid);
        } catch (error) {
          console.error("FCM 토큰 저장 실패:", error);
        }

        await updateDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          fcmToken: fcmToken || null,
          pushTime: serverTimestamp(),
        });

        push('/');
      } else {
        // ✅ 신규 사용자 또는 미완료 개인회원 - 회원가입 페이지로 (socialUserData 전달)
        console.log('Google 신규/미완료 개인회원 - 회원가입 페이지로 이동');
        
        // ✅ Redux에 사용자 정보 저장 (useSignup에서 감지)
        dispatch(setUser({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          subRegion: userDocSnap.exists() ? userDocSnap.data()?.subRegion || '' : ''
        }));

        // ✅ socialUserData를 URL 파라미터로 전달
        const params = new URLSearchParams({
          social: 'google',
          name: user.displayName || '',
          email: user.email || '',
          photoURL: user.photoURL || '',
          uid: user.uid
        });
        
        push(`/register?${params.toString()}`);
      }

    } catch (error) {
      console.error("Google login error", error);
      setErrorFromSubmit("Google 로그인에 실패했습니다.");
      setTimeout(() => setErrorFromSubmit(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  // ✅ 카카오 로그인 - state=login 사용
  const handleKakaoSign = () => {
    window.location.href = KAKAO_AUTH_URL_LOGIN;
  };

  // ✅ 기업회원 로그인
  const onEnterpriseLogin = async (data) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = result.user;

    

      // ✅ Firestore에서 기업 사용자 정보 확인
      const enterpriseDocRef = doc(db, "enterprise", user.uid);
      const enterpriseDocSnap = await getDoc(enterpriseDocRef);

      if (enterpriseDocSnap.exists()) {
        // ✅ 기업회원 - 로그인 처리
        dispatch(setUser({
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          userType: 'enterprise', // 기업회원 타입 설정
          subRegion: enterpriseDocSnap.data()?.subRegion || ''
        }));

        let fcmToken = null;
        try {
          fcmToken = await saveFcmToken(user.uid);
        } catch (error) {
          console.error("FCM 토큰 저장 실패:", error);
        }

        await updateDoc(enterpriseDocRef, {
          email: user.email,
          displayName: user.displayName || null,
          photoURL: user.photoURL || null,
          fcmToken: fcmToken || null,
          pushTime: serverTimestamp(),
        });

        push('/');
      } else {
        // ✅ 기업회원이 아님
        setErrorFromSubmit("기업회원 정보가 없거나 이메일/비밀번호가 올바르지 않습니다.");
      }
      setLoading(false);
    } catch (error) {
      setErrorFromSubmit("기업회원 정보가 없거나 이메일/비밀번호가 올바르지 않습니다.");
      setLoading(false);
      setTimeout(() => {
        setErrorFromSubmit("");
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
        <div className="flex justify-center mb-6">
          <img src="/Image/logo.png" alt="알바천국 로고" className="h-12" />
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 py-3 text-center text-lg font-semibold ${activeTab === 'personal' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab("personal")}
          >
            개인회원 
          </button>
          <button
            className={`flex-1 py-3 text-center text-lg font-semibold ${activeTab === 'enterprise' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab("enterprise")}
          >
            기업회원
          </button>
        </div>

        {errorFromSubmit && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{errorFromSubmit}</p>
          </div>
        )}

        {activeTab === "personal" && (
          <div className="space-y-4">
            {/* 이메일/비밀번호 로그인 폼 */}
            <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <input
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-500 text-base focus:outline-none focus:border-blue-400 focus:bg-white"
                  type="email"
                  name="email"
                  placeholder="아이디 (이메일)"
                  {...register("email", { required: "이메일을 입력해주세요.", pattern: { value: /^\S+@\S+$/i, message: "올바른 이메일 형식이 아닙니다." } })}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              
              <div>
                <input
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-500 text-base focus:outline-none focus:border-blue-400 focus:bg-white"
                  name="password"
                  type="password"
                  placeholder="비밀번호"
                  {...register("password", { required: "비밀번호를 입력해주세요.", minLength: { value: 6, message: "비밀번호는 6자 이상입니다." } })}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              
              
              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
            
            {/* 소셜 로그인 버튼들 */}
            <div className="flex justify-center items-center my-6">
              <span className="border-t border-gray-300 flex-grow"></span>
              <span className="px-4 text-gray-500">또는</span>
              <span className="border-t border-gray-300 flex-grow"></span>
            </div>

            <div className="space-y-3">
              <button
                className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                onClick={handleGoogleSign}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 533.5 544.3">
                  <path d="M533.5 278.4c0-18.5-1.5-37.1-4.7-55.3H272.1v104.8h147c-6.1 33.8-25.7 63.7-54.4 82.7v68h87.7c51.5-47.4 81.1-117.4 81.1-200.2z" fill="#4285f4" />
                  <path d="M272.1 544.3c73.4 0 135.3-24.1 180.4-65.7l-87.7-68c-24.4 16.6-55.9 26-92.6 26-71 0-131.2-47.9-152.8-112.3H28.9v70.1c46.2 91.9 140.3 149.9 243.2 149.9z" fill="#34a853" />
                  <path d="M119.3 324.3c-11.4-33.8-11.4-70.4 0-104.2V150H28.9c-38.6 76.9-38.6 167.5 0 244.4l90.4-70.1z" fill="#fbbc04" />
                  <path d="M272.1 107.7c38.8-.6 76.3 14 104.4 40.8l77.7-77.7C405 24.6 339.7-.8 272.1 0 169.2 0 75.1 58 28.9 150l90.4 70.1c21.5-64.5 81.8-112.4 152.8-112.4z" fill="#ea4335" />
                </svg>
                <span className="font-medium">Google 로그인</span>
              </button>
              
              <button
                className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                onClick={handleKakaoSign}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FEE500">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2.1c-6.1 0-11 3.9-11 8.7 0 3 2 5.6 5 7.1l-1 3.8c-0.1 0.3 0 0.7 0.3 0.9 0.2 0.2 0.4 0.3 0.7 0.3 0.1 0 0.3 0 0.4-0.1l4.6-3.1c0.3 0 0.7 0.1 1 0.1 6.1 0 11-3.9 11-8.7s-4.9-8.7-11-8.7z"/>
                </svg>
                <span className="font-medium">카카오 로그인</span>
              </button>
              
              {/* <button
                className="w-full flex items-center justify-center gap-3 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="font-medium">Apple 로그인</span>
              </button> */}
            </div>

            {/* 회원가입/아이디찾기/비밀번호찾기 */}
            <div className="flex justify-center gap-4 mt-6 text-sm text-gray-500">
              <button onClick={() => push("/register")} className="hover:underline">회원가입</button>
              <span>|</span>
              <button onClick={() => push("/login/find-id")} className="hover:underline">아이디 찾기</button> {/* ✅ 아이디 찾기 링크 추가 */}
              <span>|</span>
              <button onClick={() => push("/login/find-password")} className="hover:underline">비밀번호 찾기</button> {/* ✅ 비밀번호 찾기 링크 추가 */}
            </div>
          </div>
        )}

        {activeTab === "enterprise" && (
          <div className="space-y-4">
            <form className="w-full flex flex-col gap-4" onSubmit={handleEnterpriseSubmit(onEnterpriseLogin)}>
              <div>
                <input
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-500 text-base focus:outline-none focus:border-blue-400 focus:bg-white"
                  type="email"
                  name="email"
                  placeholder="아이디 (이메일)"
                  {...enterpriseRegister("email", { required: "이메일을 입력해주세요.", pattern: { value: /^\S+@\S+$/i, message: "올바른 이메일 형식이 아닙니다." } })}
                />
                {enterpriseErrors.email && <p className="text-red-500 text-xs mt-1">{enterpriseErrors.email.message}</p>}
              </div>
              
              <div>
                <input
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 placeholder-gray-500 text-base focus:outline-none focus:border-blue-400 focus:bg-white"
                  name="password"
                  type="password"
                  placeholder="비밀번호"
                  {...enterpriseRegister("password", { required: "비밀번호를 입력해주세요.", minLength: { value: 6, message: "비밀번호는 6자 이상입니다." } })}
                />
                {enterpriseErrors.password && <p className="text-red-500 text-xs mt-1">{enterpriseErrors.password.message}</p>}
              </div>
              
             

              <button
                type="submit"
                disabled={loading}
                className="mt-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>

            {/* 회원가입/아이디찾기/비밀번호찾기 */}
            <div className="flex justify-center gap-4 mt-6 text-sm text-gray-500">
              <button onClick={() => push("/register")} className="hover:underline">회원가입</button>
              <span>|</span>
              <button onClick={() => push("/login/find-id")} className="hover:underline">아이디 찾기</button>
              <span>|</span>
              <button onClick={() => push("/login/find-password")} className="hover:underline">비밀번호 찾기</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoginPage;