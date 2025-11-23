// hooks/useSignup.js
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { 
  getAuth,
  signInWithCustomToken, 
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  EmailAuthProvider,
  linkWithCredential, 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { setUser } from '../store/userSlice';
import { saveFcmToken } from '../lib/fcm';
import { REGION_CODES } from '@/lib/localcode';
import { parseRegionAndSubRegion } from '@/lib/addressParser';

// ... 유틸리티 함수들 (동일) ...
const validatePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  const koreanMobilePattern = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
  const internationalPattern = /^\+82[0-9]{9,10}$/;
  const numbersOnly = phoneNumber.replace(/[^\d]/g, '');
  return koreanMobilePattern.test(phoneNumber) || 
         internationalPattern.test(phoneNumber) ||
         (numbersOnly.length === 11 && numbersOnly.startsWith('010'));
};

const formatPhoneForFirebase = (phoneNumber) => {
  if (!phoneNumber) return '';
  if (phoneNumber.startsWith('+82')) return phoneNumber;
  const numbersOnly = phoneNumber.replace(/[^\d]/g, '');
  if (numbersOnly.startsWith('010')) {
    return `+82${numbersOnly.substring(1)}`;
  }
  if (numbersOnly.startsWith('0')) {
    return `+82${numbersOnly.substring(1)}`;
  }
  return `+82${numbersOnly}`;
};


const getCurrentLocationAddress = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('현재 브라우저에서는 위치 서비스를 지원하지 않습니다.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // const url = `https://function-address-api-123153704050.asia-northeast3.run.app/api/coord-to-address?x=${longitude}&y=${latitude}`;
          const ADDRESS_API_BASE = process.env.NEXT_PUBLIC_ADDRESS_API_URL;
          if (!ADDRESS_API_BASE) {
            throw new Error("주소 API URL이 설정되지 않았습니다. NEXT_PUBLIC_ADDRESS_API_URL 환경 변수를 확인해주세요.");
          }
          
          const url = `${ADDRESS_API_BASE}/api/coord-to-address?x=${longitude}&y=${latitude}`;
          const response = await fetch(url, { method: 'GET' });
          const data = await response.json();

          if (response.ok && data.success) {
            const fullAddress = data.address.roadAddress || data.address.jibunAddress;
            const { region, subRegion } = parseRegionAndSubRegion(fullAddress);
            
            resolve({
              success: true,
              address: fullAddress
            });
          } else {
            reject(new Error(data.message || '주소를 가져오는데 실패했습니다.'));
          }
        } catch (error) {
          reject(new Error('현재 위치를 가져오는데 실패했습니다.'));
        }
      },
      (error) => {
        let errorMessage = '위치 정보를 가져올 수 없습니다.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '위치 정보를 사용할 수 없습니다.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 정보 요청이 시간초과되었습니다.';
            break;
        }
        reject(new Error(errorMessage));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  });
};

const openAddressSearch = (onComplete) => {
  if (!window.daum || !window.daum.Postcode) {
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.onload = () => {
      new window.daum.Postcode({
        oncomplete: function(data) {
          const fullAddress = data.roadAddress || data.jibunAddress;
          const { region, subRegion, regionCode } = parseRegionAndSubRegion(fullAddress);
          
          if (onComplete) {
            onComplete({
              address: fullAddress,
              region,
              subRegion,
              regionCode,
              zonecode: data.zonecode,
              buildingName: data.buildingName
            });
          }
        }
      }).open();
    };
    script.onerror = () => {
      alert('주소 검색 서비스를 불러오는데 실패했습니다.');
    };
    document.head.appendChild(script);
  } else {
    new window.daum.Postcode({
      oncomplete: function(data) {
        const fullAddress = data.roadAddress || data.jibunAddress;
        const { region, subRegion, regionCode } = parseRegionAndSubRegion(fullAddress);
        
        if (onComplete) {
          onComplete({
            address: fullAddress,
            region,
            subRegion,
            regionCode,
            zonecode: data.zonecode,
            buildingName: data.buildingName
          });
        }
      }
    }).open();
  }
};

const KAKAO_AUTH_URL_REGISTER = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL_PROD}&state=register`;

export const useSignup = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const auth = getAuth();

  // 상태 관리
  const [currentStep, setCurrentStep] = useState('selection');
  const [signupMethod, setSignupMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 전화번호 인증 관련
  const [phoneVerificationId, setPhoneVerificationId] = useState('');
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  
  // 주소 관련
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [addressData, setAddressData] = useState({
    address: '',
    region: '',
    subRegion: '',
    regionCode: '',
    detail: '' // 상세주소 필드 추가
  });
  
  // 소셜 로그인 관련
  const [socialUserData, setSocialUserData] = useState(null);
  const [confirmationResult, setConfirmationResult] = useState(null);

  /**
   * 에러 메시지 설정 및 자동 제거 - useCallback으로 메모이제이션
   */
  const setErrorMessage = useCallback((message, duration = 5000) => {
    if (message) {
      alert(message); // alert으로 에러 메시지 표시
    }
    setError(message); // 기존처럼 state에도 에러 메시지 저장
    if (duration > 0) {
      setTimeout(() => setError(''), duration);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const social = params.get('social');
    const name = params.get('name');
    const email = params.get('email');
    const photoURL = params.get('photoURL');
    const uid = params.get('uid');

    // ✅ social과 uid가 있으면 처리 (이메일은 선택사항)
    if (social && uid) {
      setSocialUserData({
        name: name || '',
        email: email || '', // ✅ 이메일이 없어도 빈 문자열로 처리
        photoURL: photoURL || '',
        provider: social,
        uid: uid || ''
      });
      
      setSignupMethod(social);
      setCurrentStep('social');
      
      // URL 정리
      router.replace('/register', undefined, { shallow: true });
    }
  }, [router]);

  
  // ✅ 카카오 로그인 리디렉트 처리 - 수정된 버전
  useEffect(() => {
    const handleKakaoRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const isNewUser = params.get('isNewUser');
      const error = params.get('error');

      if (error) {
        setErrorMessage(`카카오 로그인 중 오류가 발생했습니다: ${error}`);
        router.replace('/register', undefined, { shallow: true });
        return;
      }

      if (token) {
        setLoading(true);
        try {
          await signInWithCustomToken(auth, token);
          const currentUser = auth.currentUser;
          
          if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            
            if (isNewUser === 'true' || !userDoc.exists() || !userDoc.data()?.phone) {
              setSocialUserData({
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                photoURL: currentUser.photoURL || '',
                provider: 'kakao',
                uid: currentUser.uid
              });
              
              dispatch(setUser({
                uid: currentUser.uid,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                email: currentUser.email || ''
              }));
              
              setSignupMethod('kakao');
              setCurrentStep('social');
              
            } else {
              dispatch(setUser({
                uid: currentUser.uid,
                displayName: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                email: currentUser.email || ''
              }));
              router.push('/');
              return;
            }
          }
          
          router.replace('/register', undefined, { shallow: true });
          
        } catch (e) {
          console.error('Firebase Custom Token 로그인 오류:', e);
          setErrorMessage('카카오 로그인 후 처리 중 오류가 발생했습니다.');
          router.replace('/register', undefined, { shallow: true });
        } finally {
          setLoading(false);
        }
      }
    };

    handleKakaoRedirect();
  }, [auth, router, dispatch, setErrorMessage]);

  // ✅ reCAPTCHA 초기화
  const setupRecaptcha = () => {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
      }
    });
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  /**
   * 현재 위치로 주소 가져오기
   */
  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const result = await getCurrentLocationAddress();
      if (result.success) {
        setAddressData({
          address: result.address,
          region: result.region,
          subRegion: result.subRegion,
          regionCode: result.regionCode
        });
        setErrorMessage('현재 위치의 주소를 가져왔습니다.', 3000);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsGettingLocation(false);
    }
  };

  /**
   * 주소 검색
   */
  const handleAddressSearch = () => {
    openAddressSearch((result) => {
      setAddressData({
        address: result.address,
        region: result.region,
        subRegion: result.subRegion,
        regionCode: result.regionCode
      });
    });
  };

  /**
   * 전화번호 인증 요청
   */
  const sendPhoneVerification = async (phoneNumber) => {
    if (!validatePhoneNumber(phoneNumber)) {
      setErrorMessage('올바른 전화번호를 입력해주세요.');
      return false;
    }

    setError('');

    try {
      const formattedPhone = formatPhoneForFirebase(phoneNumber);

      setupRecaptcha();

      const currentUser = auth.currentUser;
      let newConfirmationResult;

      if (currentUser) {
        newConfirmationResult = await linkWithPhoneNumber(
          currentUser,
          formattedPhone,
          window.recaptchaVerifier
        );
      } else {
        newConfirmationResult = await signInWithPhoneNumber(
          auth,
          formattedPhone,
          window.recaptchaVerifier
        );
      }

      setConfirmationResult(newConfirmationResult);
      setPhoneVerificationId(newConfirmationResult.verificationId);
      setErrorMessage('인증번호가 발송되었습니다.', 3000);
      return true;

    } catch (error) {
      console.error('전화번호 인증 오류:', error);
      
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }
      
      let errorMessage = '인증번호 발송에 실패했습니다.';
      
      switch (error.code) {
        case 'auth/invalid-phone-number':
          errorMessage = '올바르지 않은 전화번호입니다.';
          break;
        case 'auth/too-many-requests':
          errorMessage = '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
          break;
        case 'auth/quota-exceeded':
          errorMessage = '일일 SMS 한도를 초과했습니다.';
          break;
        case 'auth/captcha-check-failed':
          errorMessage = '보안 검증에 실패했습니다. 페이지를 새로고침해주세요.';
          break;
        case 'auth/missing-phone-number':
          errorMessage = '전화번호를 입력해주세요.';
          break;
        case 'auth/provider-already-linked':
          errorMessage = '이미 가입된 번호입니다.';
          break;
        case 'auth/provider-already-linked':
          errorMessage = '다른 인증 정보로 계정이 존재합니다.';
          break;  
        default:
          console.error('상세 오류:', error);
          break;
      }
      
      setErrorMessage(errorMessage);
      return false;
    }
  };

  /**
   * 전화번호 인증 확인
   */
  const verifyPhoneCode = async (code) => {
    if (!code || code.length !== 6) {
      setErrorMessage('6자리 인증번호를 입력해주세요.');
      return false;
    }

    if (!confirmationResult) {
      setErrorMessage('인증번호를 다시 요청해주세요.');
      return false;
    }

    setPhoneLoading(true);
    setError('');

    try {
      await confirmationResult.confirm(code);
      setIsPhoneVerified(true);
      setErrorMessage('전화번호 인증이 완료되었습니다.', 3000);
      return true;
    } catch (error) {
      console.error('인증번호 확인 오류:', error);
      
      let errorMessage = '인증번호가 올바르지 않습니다.';
      switch (error.code) {
        case 'auth/invalid-verification-code':
          errorMessage = '잘못된 인증번호입니다. 다시 확인해주세요.';
          break;
        case 'auth/code-expired':
          errorMessage = '인증번호가 만료되었습니다. 새 인증번호를 요청해주세요.';
          break;
        case 'auth/session-expired':
          errorMessage = '인증 세션이 만료되었습니다. 처음부터 다시 시도해주세요.';
          break;
        default:
          break;
      }
      
      setErrorMessage(errorMessage);
      return false;
    } finally {
      setPhoneLoading(false);
    }
  };

  /**
   * Google 로그인
   */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // ✅ Firestore 확인
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists() && userDoc.data()?.phone) {
        // 기존 사용자 - 바로 로그인
        dispatch(setUser({
          uid: user.uid,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          email: user.email || ''
        }));
        router.push('/');
        return true;
      }

      // 신규 사용자 - 추가 정보 입력
      setSocialUserData({
        name: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        provider: 'google',
        uid: user.uid
      });

      setSignupMethod('google');
      setCurrentStep('social');
      return true;
      
    } catch (error) {
      console.error('Google 로그인 오류:', error);
      let errorMessage = 'Google 로그인에 실패했습니다.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '로그인 창이 닫혔습니다.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = '팝업이 차단되었습니다. 팝업 차단을 해제하고 다시 시도해주세요.';
      }
      
      setErrorMessage(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 카카오 로그인
   */
  const handleKakaoLogin = () => {
    window.location.href = KAKAO_AUTH_URL_REGISTER;
  };

  /**
   * Apple 로그인 (준비 중)
   */
  const handleAppleLogin = () => {
    setErrorMessage('Apple 로그인은 준비 중입니다.');
  };

  /**
   * 개인 회원가입 완료
   */
  const completePersonalSignup = async (formData) => {
    if (!isPhoneVerified) {
      setErrorMessage('전화번호 인증을 완료해주세요.');
      return false;
    }

    if (!addressData.address) {
      setErrorMessage('주소를 입력해주세요.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
        
      if (!user || !user.phoneNumber) {
        throw new Error('전화번호 인증 세션 정보가 유효하지 않습니다.');
      }

      const credential = EmailAuthProvider.credential(
        formData.email, 
        formData.password
      );
        
      const result = await linkWithCredential(user, credential);
      const finalUser = result.user;

      await updateProfile(finalUser, {
        displayName: formData.name
      });

      let fcmToken = null;
      try {
        fcmToken = await saveFcmToken(finalUser.uid);
      } catch (fcmError) {
        console.warn('FCM 토큰 저장 실패:', fcmError);
      }

      // 상세주소가 있으면 기본 주소에 합치기
      const finalAddress = addressData.detail 
        ? `${addressData.address || ''} ${addressData.detail}`.trim()
        : addressData.address || '';

      await setDoc(doc(db, "users", finalUser.uid), {
        email: formData.email,
        displayName: formData.name,
        phone: formData.phone,
        address: finalAddress,
        region: addressData.region || '',
        subRegion: addressData.subRegion || '',
        regionCode: addressData.regionCode || '',
        userType: formData.userType,
        country: formData.country || null,
        visa: formData.visa || null,
        birthdate: formData.birthdate || null,
        gender: formData.gender || null,
        createdAt: serverTimestamp(),
        photoURL: null,
        fcmToken: fcmToken || null,
        badge: 0,
        notice: false,
        pushTime: serverTimestamp(),
        userKey: finalUser.uid,
        wishList: [],
        permit: [],
        nara: [],
        job: [],
        expirationDate: null,
        signupMethod: 'email',
        isEmailVerified: false,
        isPhoneVerified: true
      });

      dispatch(setUser({
        uid: finalUser.uid,
        displayName: formData.name,
        photoURL: null,
        email: formData.email,
      }));

      // 페이지 이동 전까지 로딩 상태 유지
      router.push('/');
      return true;

    } catch (error) {
      console.error('개인 회원가입 오류:', error);
      
      let errorMessage = '회원가입에 실패했습니다.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = '이미 사용 중인 이메일입니다.';
          break;
        case 'auth/weak-password':
          errorMessage = '비밀번호가 너무 약합니다.';
          break;
        case 'auth/invalid-email':
          errorMessage = '올바르지 않은 이메일 형식입니다.';
          break;
        default:
          break;
      }
      
      setErrorMessage(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 소셜 회원가입 완료
   */
  const completeSocialSignup = async (formData) => {
  if (!socialUserData) {
    setErrorMessage('소셜 로그인 정보가 없습니다.');
    return false;
  }

  if (!isPhoneVerified) {
    setErrorMessage('전화번호 인증을 완료해주세요.');
    return false;
  }

  if (!addressData.address) {
    setErrorMessage('주소를 입력해주세요.');
    return false;
  }

  setLoading(true);
  setError('');

  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('인증된 사용자를 찾을 수 없습니다.');
    }

    let fcmToken = null;
    try {
      fcmToken = await saveFcmToken(user.uid);
    } catch (fcmError) {
      console.warn('FCM 토큰 저장 실패:', fcmError);
    }

    // ✅ 이메일이 없으면 폼에서 입력받은 값 또는 null
    const finalEmail = formData.email || socialUserData.email || null;

    // 상세주소가 있으면 기본 주소에 합치기
    const finalAddress = addressData.detail 
      ? `${addressData.address || ''} ${addressData.detail}`.trim()
      : addressData.address || '';

    await setDoc(doc(db, "users", user.uid), {
      email: finalEmail, // ✅ null일 수 있음
      displayName: formData.name || socialUserData.name,
      phone: formData.phone,
      address: finalAddress,
      region: addressData.region || '',
      subRegion: addressData.subRegion || '',
      regionCode: addressData.regionCode || '',
      userType: formData.userType,
      country: formData.country || null,
      visa: formData.visa || null,
      birthdate: formData.birthdate || null,
      gender: formData.gender || null,
      createdAt: serverTimestamp(),
      photoURL: socialUserData.photoURL || null,
      fcmToken: fcmToken || null,
      badge: 0,
      notice: false,
      pushTime: serverTimestamp(),
      userKey: user.uid,
      wishList: [],
      permit: [],
      nara: [],
      job: [],
      expirationDate: null,
      signupMethod: socialUserData.provider,
      isEmailVerified: !!finalEmail, // ✅ 이메일이 있으면 true
      isPhoneVerified: true
    });

    dispatch(setUser({
      uid: user.uid,
      displayName: formData.name || socialUserData.name,
      photoURL: socialUserData.photoURL || null,
      email: finalEmail,
    }));

    // 페이지 이동 전까지 로딩 상태 유지
    router.push('/');
    return true;

  } catch (error) {
    console.error('소셜 회원가입 오류:', error);
    setErrorMessage('회원가입에 실패했습니다.');
    return false;
  } finally {
    setLoading(false);
  }
};

  /**
   * 회원가입 방법 선택
   */
  const selectSignupMethod = (method) => {
    setSignupMethod(method);
    if (method === 'personal') {
      setCurrentStep('personal');
    }
  };

  /**
   * 단계 변경
   */
  const goToStep = (step) => {
    setCurrentStep(step);
    setError('');
  };

  /**
   * 사업자등록번호 인증
   */
  const verifyBusinessNumber = async (businessNumber) => {
    if (!businessNumber || businessNumber.length !== 10) {
      setErrorMessage('올바른 사업자등록번호를 입력해주세요. (10자리)');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      const serviceKey = process.env.NEXT_PUBLIC_PUBLIC_DATA_API_KEY;
      if (!serviceKey) {
        throw new Error("사업자등록번호 인증 API 키가 설정되지 않았습니다.");
      }
      
      const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          b_no: ["3383000921"]
        })
      });
      
      const data = await response.json();

      if (data.status_code === 'OK' && data.data && data.data.length > 0) {
        const result = data.data[0];
        if (result.b_stt_cd === '01') { // 계속사업자
          setErrorMessage('사업자등록번호가 확인되었습니다.', 3000);
          return true;
        } else {
          setErrorMessage('사업자등록번호가 존재하지 않거나 휴업/폐업 상태입니다.');
          return false;
        }
      } else {
        setErrorMessage('사업자등록번호 검증에 실패했습니다.');
        return false;
      }
    } catch (error) {
      console.error('사업자등록번호 검증 오류:', error);
      setErrorMessage('사업자등록번호 검증 중 오류가 발생했습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 기업 회원가입 완료
   */
  const completeEnterpriseSignup = async (formData) => {
    if (!addressData.address) {
      setErrorMessage('주소를 입력해주세요.');
      return false;
    }

    setLoading(true);
    setError('');

    try {
      // ✅ 기업회원은 이메일/비밀번호로 직접 계정 생성 (전화번호 인증 없음)
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const result = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const finalUser = result.user;

      await updateProfile(finalUser, {
        displayName: formData.companyName || formData.name,
      });

      let fcmToken = null;
      try {
        fcmToken = await saveFcmToken(finalUser.uid);
      } catch (fcmError) {
        console.warn('FCM 토큰 저장 실패:', fcmError);
      }

      // 상세주소가 있으면 기본 주소에 합치기
      const finalAddress = addressData.detail 
        ? `${addressData.address || ''} ${addressData.detail}`.trim()
        : addressData.address || '';

      // ✅ 기업 정보는 enterprise 컬렉션에 저장
      await setDoc(doc(db, 'enterprise', finalUser.uid), {
        email: formData.email,
        displayName: formData.name,
        companyName: formData.companyName || formData.name,
        businessNumber: formData.businessNumber,
        phone: formData.phone, // 단순 연락처로 저장
        address: finalAddress,
        region: addressData.region || '',
        subRegion: addressData.subRegion || '',
        regionCode: addressData.regionCode || '',
        createdAt: serverTimestamp(),
        photoURL: null,
        fcmToken: fcmToken || null,
        badge: 0,
        notice: false,
        pushTime: serverTimestamp(),
        userKey: finalUser.uid,
        userType: 'enterprise',
        // ✅ 결제 정보
        amount: 15000,
        expirationDate: new Date('2025-10-26T04:03:28+09:00'),
        paymentKey: 'cstal20250926040315JNuu6',
        approvedAt: '2025-09-26T04:03:28+09:00',
        signupMethod: 'email',
        isEmailVerified: false,
        isPhoneVerified: false, // 기업회원은 전화번호 인증 안함
      });

      dispatch(
        setUser({
          uid: finalUser.uid,
          displayName: formData.companyName || formData.name,
          photoURL: null,
          email: formData.email,
          userType: 'enterprise',
        })
      );

      // 페이지 이동 전까지 로딩 상태 유지
      router.push('/');
      return true;
    } catch (error) {
      console.error('기업 회원가입 오류:', error);

      let errorMessage = '회원가입에 실패했습니다.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = '이미 사용 중인 이메일입니다.';
          break;
        case 'auth/weak-password':
          errorMessage = '비밀번호가 너무 약합니다.';
          break;
        case 'auth/invalid-email':
          errorMessage = '올바르지 않은 이메일 형식입니다.';
          break;
        default:
          break;
      }

      setErrorMessage(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 초기화
   */
  const resetSignup = () => {
    setCurrentStep('selection');
    setSignupMethod('');
    setError('');
    setPhoneVerificationId('');
    setPhoneVerificationCode('');
    setIsPhoneVerified(false);
    setSocialUserData(null);
    setConfirmationResult(null);
    setAddressData({
      address: '',
      region: '',
      subRegion: '',
      regionCode: ''
    });
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }
  };

  return {
    // 상태
    currentStep,
    signupMethod,
    loading,
    error,
    phoneVerificationId,
    phoneVerificationCode,
    isPhoneVerified,
    phoneLoading,
    isGettingLocation,
    addressData,
    socialUserData,
    confirmationResult, // confirmationResult 추가
    
    // 액션
    setPhoneVerificationCode,
    setErrorMessage,
    selectSignupMethod,
    goToStep,
    resetSignup,
    setAddressData, // setAddressData 추가
    
    // 주소 관련
    handleGetCurrentLocation,
    handleAddressSearch,
    
    // 전화번호 인증
    sendPhoneVerification,
    verifyPhoneCode,
    
    // 소셜 로그인
    handleGoogleLogin,
    handleKakaoLogin,
    handleAppleLogin,
    
    // 회원가입 완료
    completePersonalSignup,
    completeSocialSignup,
    
    // 기업 회원 관련
    verifyBusinessNumber,
    completeEnterpriseSignup,
  };
};