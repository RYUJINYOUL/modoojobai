import { db } from '@/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';

const FCM_SERVER_URL = process.env.NEXT_PUBLIC_FCM_SERVER_URL || 'https://your-fcm-server.run.app';

interface SendNotificationParams {
  userId: string;
  applicationId: string;
  jobTitle: string;
  oldStatus: string;
  newStatus: string;
}

export const sendApplicationStatusNotification = async (params: SendNotificationParams) => {
  const { userId, applicationId, jobTitle, oldStatus, newStatus } = params;

  try {
    // 1. 사용자 FCM 토큰 가져오기
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('사용자를 찾을 수 없습니다');
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;
    const notificationsEnabled = userData.notificationsEnabled !== false;

    if (!fcmToken) {
      console.warn('FCM 토큰이 없습니다');
      return;
    }

    if (!notificationsEnabled) {
      console.log('사용자가 알림을 비활성화했습니다');
      return;
    }

    // 2. 알림 메시지 생성
    const statusLabels: { [key: string]: string } = {
      submitted: '제출',
      reviewed: '검토중',
      interview: '면접',
      accepted: '합격',
      rejected: '불합격'
    };

    const title = `📋 ${jobTitle}`;
    const body = `지원서 상태가 '${statusLabels[oldStatus]}'에서 '${statusLabels[newStatus]}'(으)로 변경되었습니다.`;

    // 3. Firestore에 알림 저장
    const notificationsRef = collection(db, 'push', userId, 'notifications');
    const notificationData = {
      type: 'status_change',
      title,
      body,
      data: {
        applicationId,
        jobTitle,
        oldStatus,
        newStatus,
        link: `/applications/${applicationId}` // 🎯 클릭 시 이동할 링크 추가
      },
      notice: true, // 기본값 true
      read: false,
      badge: 0,
      pushTime: new Date(),
      createdAt: new Date()
    };

    const notificationDoc = await addDoc(notificationsRef, notificationData);
    console.log('✅ Firestore에 알림 저장 완료:', notificationDoc.id);

    // 4. FCM 서버로 푸시 알림 요청
    try {
      const response = await fetch(`${FCM_SERVER_URL}/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fcmToken,
          title,
          body,
          data: {
            type: 'status_change',
            applicationId,
            jobTitle,
            oldStatus,
            newStatus,
            link: `/applications/${applicationId}` // 🎯 클릭 시 이동할 링크 추가
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('FCM 전송 실패:', errorData);
      } else {
        console.log('✅ FCM 푸시 알림 전송 완료');
      }
    } catch (error) {
      console.error('FCM 서버 호출 실패:', error);
      // FCM 실패해도 Firestore에는 저장됨
    }

  } catch (error) {
    console.error('알림 전송 중 오류:', error);
    throw error;
  }
};

// 일괄 알림 전송
export const sendBulkApplicationStatusNotifications = async (
  applications: Array<{ userId: string; applicationId: string; jobTitle: string }>,
  oldStatus: string,
  newStatus: string
) => {
  const promises = applications.map(app =>
    sendApplicationStatusNotification({
      userId: app.userId,
      applicationId: app.applicationId,
      jobTitle: app.jobTitle,
      oldStatus,
      newStatus
    })
  );

  try {
    await Promise.all(promises);
    console.log(`✅ ${applications.length}명에게 알림 전송 완료`);
  } catch (error) {
    console.error('일괄 알림 전송 중 오류:', error);
    throw error;
  }
};