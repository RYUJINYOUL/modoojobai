import { getMessaging, getToken } from "firebase/messaging";

export async function saveFcmToken() {
  // 서버 사이드에서는 실행하지 않음
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Service Worker 지원 확인
    if (!('serviceWorker' in navigator)) {
      console.log("Service Worker 미지원 브라우저");
      return null;
    }

    // 알림 권한 먼저 확인
    if (Notification.permission === 'denied') {
      console.log("알림 권한이 거부되었습니다.");
      return null;
    }

    // 알림 권한 요청
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("알림 권한이 허용되지 않았습니다.");
        return null;
      }
    }

    // 🎯 Service Worker가 준비될 때까지 최대 10초 대기
    const swReady = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Service Worker 타임아웃')), 10000)
      )
    ]);

    console.log("✅ Service Worker 준비 완료");

    // Firebase Messaging 초기화
    const messaging = getMessaging();

    // VAPID 키 확인
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      throw new Error("VAPID 키가 설정되지 않았습니다.");
    }

    // FCM 토큰 발급
    const token = await getToken(messaging, { vapidKey });

    if (token) {
      console.log("✅ FCM 토큰 발급 성공");
      return token;
    } else {
      console.log("FCM 토큰을 발급받을 수 없습니다.");
      return null;
    }

  } catch (error) {
    console.warn("FCM 토큰 발급 실패:", error.message);
    return null;
  }
}