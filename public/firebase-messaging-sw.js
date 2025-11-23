// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 🎯 하드코딩된 설정값 (process.env 사용 불가)
const firebaseConfig = {
    apiKey: "AIzaSyCVt8_your_actual_api_key_here",
    authDomain: "aijob-abf44.firebaseapp.com",
    projectId: "aijob-abf44",
    storageBucket: "aijob-abf44.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:your_app_id_here"
};

// Firebase 초기화
try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 1. 백그라운드 메시지 처리 (FCM 서버에서 보낸 메시지 처리)
    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] 백그라운드 메시지:', payload);

        const notificationTitle = payload.notification?.title || '알림';
        
        // ✨ 개선된 알림 옵션 - 검정 배경과 더 나은 스타일링
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/icon.png',
            badge: '/icon.png',
            image: payload.notification?.image,
            requireInteraction: true, // 클릭 전까지 계속 표시
            silent: false,
            vibrate: [200, 100, 200],
            actions: [
                {
                    action: 'view',
                    title: '확인하기',
                    icon: '/icon.png'
                },
                {
                    action: 'close',
                    title: '닫기',
                    icon: '/icon.png'
                }
            ],
            data: { 
                link: payload.data?.link,
                timestamp: Date.now()
            }
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // 2. 원시 Push 이벤트 처리 (DevTools 테스트 메시지 처리)
    self.addEventListener('push', (event) => {
        // payload.data가 없거나 알 수 없는 경우에 대비하여 기본값 설정
        const data = event.data.json();
        console.log('[SW] 원시 Push 이벤트 수신:', data);

        const title = data.notification?.title || '테스트 알림';
        
        // ✨ 개선된 테스트 알림 옵션
        const options = {
            body: data.notification?.body || '개발자 도구 테스트 메시지입니다.',
            icon: '/icon.png',
            badge: '/icon.png',
            requireInteraction: true, // 클릭 전까지 계속 표시
            silent: false,
            vibrate: [200, 100, 200],
            actions: [
                {
                    action: 'view',
                    title: '확인하기',
                    icon: '/icon.png'
                },
                {
                    action: 'close',
                    title: '닫기',
                    icon: '/icon.png'
                }
            ],
            data: { 
                link: data.data?.link || '/default-path',
                timestamp: Date.now()
            }
        };

        // 알림 표시를 예약하고 워커가 종료되지 않도록 대기
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    });

    // 3. 알림 클릭 이벤트 처리 - 액션 버튼 지원
    self.addEventListener('notificationclick', (event) => {
        console.log('[SW] 알림 클릭:', event.notification);
        console.log('[SW] 클릭된 액션:', event.action);

        event.notification.close();

        // 닫기 액션인 경우 아무것도 하지 않음
        if (event.action === 'close') {
            return;
        }

        const rawData = event.notification.data;
        console.log('[SW] 알림 Data 객체:', rawData); 
        
        const link = event.notification.data?.link;
        console.log('[SW] 추출된 Link:', link);

        // 절대 URL로 변환
        const baseUrl = self.location.origin;
        const fullUrl = link ? `${baseUrl}${link}` : `${baseUrl}/`;
        
        console.log('[SW] 최종 이동 URL:', fullUrl);

        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // 이미 열린 탭이 있는지 확인
                for (const client of clientList) {
                    if (client.url === fullUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // 새 창/탭 열기
                if (clients.openWindow) {
                    return clients.openWindow(fullUrl);
                }
            })
        );
    });

    console.log('[SW] Firebase Messaging 초기화 성공');
} catch (error) {
    console.error('[SW] Firebase 초기화 실패:', error);
}