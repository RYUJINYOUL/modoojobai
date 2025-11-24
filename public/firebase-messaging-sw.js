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

    // 알림 권한 상태 확인
    console.log('[SW] 알림 권한 상태:', Notification.permission);

    // 1. 백그라운드 메시지 처리 (FCM 서버에서 보낸 메시지 처리)
    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] 백그라운드 메시지:', payload);

        const notificationTitle = payload.notification?.title || '알림';
        
        // ✨ 개선된 알림 옵션 - 아이콘 경로 수정
        const notificationOptions = {
            body: payload.notification?.body || '',
            icon: '/Image/logo.png', // 실제 존재하는 아이콘 경로로 변경
            badge: '/Image/logo.png',
            image: payload.notification?.image,
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200],
            tag: payload.notification?.tag || 'fcm-notification', // 중복 알림 방지
            actions: [
                {
                    action: 'view',
                    title: '확인하기'
                },
                {
                    action: 'close',
                    title: '닫기'
                }
            ],
            data: { 
                link: payload.data?.link,
                timestamp: Date.now(),
                originalPayload: payload
            }
        };

        console.log('[SW] FCM 백그라운드 알림 표시 시도:', notificationTitle, notificationOptions);

        self.registration.showNotification(notificationTitle, notificationOptions);
    });

    // 2. 원시 Push 이벤트 처리 (DevTools 테스트 메시지 처리)
    self.addEventListener('push', (event) => {
        console.log('[SW] Push 이벤트 수신됨');
        
        if (!event.data) {
            console.log('[SW] Push 이벤트에 데이터가 없음');
            return;
        }

        let data;
        try {
            data = event.data.json();
            console.log('[SW] 원시 Push 이벤트 수신:', data);
        } catch (error) {
            console.error('[SW] Push 데이터 파싱 실패:', error);
            // 기본 알림 표시
            data = {
                notification: {
                    title: '새 알림',
                    body: '알림이 도착했습니다.'
                }
            };
        }

        const title = data.notification?.title || '새 알림';
        
        // ✨ 개선된 테스트 알림 옵션 - 아이콘 경로 수정
        const options = {
            body: data.notification?.body || '알림이 도착했습니다.',
            icon: '/Image/logo.png', // 실제 존재하는 아이콘 경로로 변경
            badge: '/Image/logo.png',
            requireInteraction: true,
            silent: false,
            vibrate: [200, 100, 200],
            tag: data.notification?.tag || 'default-notification', // 중복 알림 방지
            actions: [
                {
                    action: 'view',
                    title: '확인하기'
                },
                {
                    action: 'close',
                    title: '닫기'
                }
            ],
            data: { 
                link: data.data?.link || '/',
                timestamp: Date.now(),
                originalData: data
            }
        };

        console.log('[SW] 알림 표시 시도:', title, options);

        // 알림 표시를 예약하고 워커가 종료되지 않도록 대기
        event.waitUntil(
            self.registration.showNotification(title, options)
                .then(() => {
                    console.log('[SW] 알림 표시 성공');
                })
                .catch((error) => {
                    console.error('[SW] 알림 표시 실패:', error);
                })
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