"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { useDispatch } from 'react-redux';
import { auth, db } from '@/firebase';
import { setUser } from "@/store/userSlice";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { saveFcmToken } from "@/lib/fcm";

const KakaoAuthPage = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingMessage, setLoadingMessage] = useState("카카오 로그인 처리 중...");

  useEffect(() => {
    const customToken = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setLoadingMessage(`로그인 실패: ${errorParam}`);
      router.push(`/login?error=${errorParam}`);
      return;
    }

    if (customToken) {
      setLoadingMessage("모두잡AI 로그인 중...");

      signInWithCustomToken(auth, customToken)
        .then(async (userCredential) => {
          const user = userCredential.user;

          console.log('카카오 사용자 정보:', {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email, // null일 수 있음
            photoURL: user.photoURL
          });

          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists() && userSnap.data()?.phone) {
            // ✅ 완전한 회원 - 로그인 처리
            dispatch(setUser({
              uid: user.uid,
              displayName: user.displayName ?? "",
              photoURL: user.photoURL ?? "",
              email: user.email ?? "",
              subRegion: userSnap.data()?.subRegion || ''
            }));

            let fcmToken = null;
            try {
              fcmToken = await saveFcmToken(user.uid);
            } catch (err) {
              console.error("⚠️ FCM 토큰 저장 실패:", err);
            }

            await updateDoc(userRef, {
              email: user.email ?? null,
              displayName: user.displayName ?? null,
              photoURL: user.photoURL ?? null,
              fcmToken: fcmToken ?? null,
              pushTime: serverTimestamp(),
            });

            router.push('/');
          } else {
            // ✅ 신규 사용자 - 회원가입으로 (이메일 없어도 전달)
            console.log('카카오 신규 사용자 - 회원가입 페이지로');
            
            const params = new URLSearchParams({
              social: 'kakao',
              name: user.displayName || '',
              email: user.email || '', // ✅ 빈 문자열로 전달
              photoURL: user.photoURL || '',
              uid: user.uid
            });
            
            router.push(`/register?${params.toString()}`);
          }
        })
        .catch((error) => {
          console.error("❌ Firebase 인증 실패:", error);
          setLoadingMessage("모두잡AI 로그인 실패!");
          router.push('/login?error=firebase_auth_failed');
        });
    } else {
      setLoadingMessage("잘못된 접근입니다.");
      router.push('/login?error=invalid_access');
    }
  }, [searchParams, router, dispatch]);

  return (
    <div className="p-8 text-center">
      <p className="text-gray-700">{loadingMessage}</p>
    </div>
  );
};

export default KakaoAuthPage;