"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );
      } catch (err) {
        const error = err as Error;
        console.warn("⚠️ Service Worker 등록 실패:", error.message);
      }
    };

    // 페이지 로드 시 즉시 등록
    registerSW();
  }, []);

  return null;
}