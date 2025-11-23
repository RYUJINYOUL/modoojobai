'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, RecaptchaVerifier, updatePhoneNumber, PhoneAuthProvider } from 'firebase/auth';
import { User, MapPin, Phone, KeyRound, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '@/firebase';
import { useSignup } from '@/lib/Usesignup'; // useSignup 훅 가져오기

declare global { interface Window { daum: any; } }
export default function EditProfilePage() {
  const { currentUser } = useSelector((state: any) => state.user);
  const router = useRouter();
  const auth = getAuth();

  const {
    addressData,
    setAddressData,
    handleGetCurrentLocation,
    sendPhoneVerification,
    verifyPhoneCode,
    isPhoneVerified,
    setErrorMessage,
    loading: signupLoading, // useSignup 훅의 로딩 상태
    phoneLoading,
    isGettingLocation,
    error: signupError, // useSignup 훅의 에러 상태도 가져옴
    confirmationResult, // confirmationResult 추가
  } = useSignup();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [isPhoneUpdateInitiated, setIsPhoneUpdateInitiated] = useState(false); // 휴대폰 번호 변경 시작 여부

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [baseAddress, setBaseAddress] = useState(''); // 주소 검색 결과 원본 저장
  const [localAddressData, setLocalAddressData] = useState({
    address: '',
    region: '',
    subRegion: '',
    regionCode: '',
    detail: ''
  }); // 로컬 주소 데이터 (에러 시에도 유지)

  // signupError 또는 자체 error가 있으면 표시
  const displayError = error || signupError;

  useEffect(() => {
    if (!currentUser?.uid) {
      router.push('/login'); // 로그인하지 않았으면 로그인 페이지로 리다이렉트
    } else {
      // 현재 사용자 정보 불러오기 (초기값 설정)
      const fetchUserProfile = async () => {
        const collectionName = currentUser.userType === 'enterprise' ? 'enterprise' : 'users';
        const userDocRef = doc(db, collectionName, currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setDisplayName(userData.displayName || '');
          setPhone(userData.phone || '');
          const addressInfo = {
            address: userData.address || '',
            region: userData.region || '',
            subRegion: userData.subRegion || '',
            regionCode: userData.regionCode || '',
            detail: ''
          };
          setAddressData(addressInfo);
          setLocalAddressData(addressInfo);
          setBaseAddress(userData.address || '');
        }
      };
      fetchUserProfile();
    }
  }, [currentUser?.uid, router, setAddressData]);

  const handleAddressSearch = () => {
    const openDaumPostcode = (onComplete: (data: any) => void) => {
      new window.daum.Postcode({
        oncomplete: function(data: any) {
          const fullAddress = data.roadAddress || data.jibunAddress;
          // `parseRegionAndSubRegion`이 useSignup 훅에 없으므로, 여기서 간단히 구현하거나 가져와야 합니다.
          // 우선 간단한 분리 로직을 사용합니다.
          const addressParts = fullAddress.split(' ');
          const region = addressParts[0] || '';
          const subRegion = addressParts[1] || '';

          if (onComplete) {
            onComplete({
              address: fullAddress,
              region: region,
              subRegion: subRegion,
              // regionCode는 recruit 페이지에만 필요하므로 여기서는 생략 가능
            });
          }
        }
      }).open();
    };

    if (!window.daum || !window.daum.Postcode) {
      const script = document.createElement('script');
      script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      document.head.appendChild(script);
      script.onload = () => {
        openDaumPostcode((result) => {
          setBaseAddress(result.address);
          const newAddressData = { ...localAddressData, ...result, detail: '' };
          setAddressData(newAddressData);
          setLocalAddressData(newAddressData);
        });
      }
      script.onerror = () => {
        alert('주소 검색 서비스를 불러오는데 실패했습니다.');
      };
    } else {
      openDaumPostcode((result) => {
        setBaseAddress(result.address);
        const newAddressData = { ...localAddressData, ...result, detail: '' };
        setAddressData(newAddressData);
        setLocalAddressData(newAddressData);
      });
    }
  };

  // 상세주소 변경 시 전체 주소 업데이트
  useEffect(() => {
    if (baseAddress && localAddressData.detail) {
      const fullAddress = `${baseAddress} ${localAddressData.detail}`.trim();
      setAddressData(prev => ({ ...prev, address: fullAddress }));
      setLocalAddressData(prev => ({ ...prev, address: fullAddress }));
    } else if (baseAddress) {
      setAddressData(prev => ({ ...prev, address: baseAddress }));
      setLocalAddressData(prev => ({ ...prev, address: baseAddress }));
    }
  }, [localAddressData.detail, baseAddress]);


  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    setLoading(true);
    setError('');

    try {
      const collectionName = currentUser.userType === 'enterprise' ? 'enterprise' : 'users';
      const userDocRef = doc(db, collectionName, currentUser.uid);
      
      await updateDoc(userDocRef, {
        displayName: displayName,
        address: localAddressData.address,
        region: localAddressData.region,
        subRegion: localAddressData.subRegion,
        regionCode: localAddressData.regionCode, // regionCode도 업데이트
        // phone: isPhoneVerified ? phone : currentUser?.phone, // 전화번호는 인증 완료 시에만 업데이트
      });

      setErrorMessage('프로필 정보가 성공적으로 업데이트되었습니다.', 3000);
      router.push('/profile'); // 프로필 메인 페이지로 이동

    } catch (err: any) {
      console.error('프로필 업데이트 오류:', err);
      setErrorMessage(`프로필 업데이트 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!phone) {
      setErrorMessage('휴대폰 번호를 입력해주세요.');
      return;
    }
    setIsPhoneUpdateInitiated(true);
    setError(''); // 기존 에러 초기화
    const success = await sendPhoneVerification(phone);
    
    // 에러 발생 시 상태 초기화하지 않고 재시도 가능하도록 유지
    if (!success) {
      // setIsPhoneUpdateInitiated(false); // 이 줄을 제거하여 재시도 가능하게 함
      console.log('휴대폰 인증 요청 실패, 재시도 가능');
    }
  };

  // 휴대폰 인증 상태 초기화 함수 추가
  const resetPhoneVerification = () => {
    setIsPhoneUpdateInitiated(false);
    setVerificationCode('');
    setError('');
    // useSignup 훅의 에러도 초기화
    if (setErrorMessage) {
      setErrorMessage('');
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (!verificationCode) {
      setErrorMessage('인증번호를 입력해주세요.');
      return;
    }
    const success = await verifyPhoneCode(verificationCode);
    if (success && currentUser?.uid && phone && confirmationResult) {
      // Firebase auth user의 전화번호 업데이트 (이미 로그인된 사용자)
      try {
        const credential = PhoneAuthProvider.credential((confirmationResult as any).verificationId, verificationCode);
        if (auth.currentUser) {
          await updatePhoneNumber(auth.currentUser, credential);
        }

        // Firestore에도 전화번호 업데이트
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, { phone: phone });
        // setErrorMessage('휴대폰 번호가 성공적으로 변경되었습니다.', 3000);
        // alert 사용으로 변경
        if (typeof window !== 'undefined') {
          alert('휴대폰 번호가 성공적으로 변경되었습니다.');
        }
        setIsPhoneUpdateInitiated(false); // 인증 완료 후 초기화
      } catch (err: any) {
        console.error('Firebase 휴대폰 번호 업데이트 오류:', err);
        setErrorMessage(`휴대폰 번호 업데이트 실패: ${err.message}`);
      }
    }
  };


  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">프로필 정보 수정</h1>
        
        {displayError && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl relative mb-6 flex items-start gap-3" role="alert">
            <AlertTriangle className="w-5 h-5 mt-0.5 text-red-400" />
            <div className="flex-1">
              <span className="block sm:inline">{displayError}</span>
              {/* 휴대폰 인증 관련 에러일 때 재시도 버튼 표시 */}
              {(displayError.includes('휴대폰') || displayError.includes('인증') || displayError.includes('전화')) && (
                <button
                  onClick={resetPhoneVerification}
                  className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
                >
                  다시 시도
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-8">
          {/* 기본 정보 */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3"><User className="w-6 h-6 text-blue-400"/>기본 정보</h2>
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">이름</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="block w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
              />
            </div>
          </div>

          {/* 지역 정보 */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3"><MapPin className="w-6 h-6 text-green-400"/>지역 정보</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-2">주소</label>
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <input
                    type="text"
                    id="address"
                    value={localAddressData.address}
                    onChange={(e) => {
                      const newAddress = e.target.value;
                      setLocalAddressData(prev => ({ ...prev, address: newAddress }));
                      setAddressData(prev => ({ ...prev, address: newAddress }));
                      // 사용자가 직접 주소를 수정할 경우, baseAddress도 업데이트
                      if (!localAddressData.detail) {
                        setBaseAddress(newAddress);
                      }
                    }}
                    placeholder="아래 버튼을 눌러 주소를 검색하세요"
                    className="flex-1 block w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg shadow-sm text-white placeholder-gray-500"
                  />
                  <div className="flex w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="상세주소"
                      value={localAddressData.detail || ''}
                      onChange={(e) => {
                        const newDetail = e.target.value;
                        setLocalAddressData(prev => ({ ...prev, detail: newDetail }));
                        setAddressData(prev => ({ ...prev, detail: newDetail }));
                      }}
                      className="flex-1 sm:w-32 px-4 py-3 bg-white/5 border border-white/20 rounded-lg shadow-sm text-white placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleAddressSearch}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500"
                >
                  주소 검색
                </button>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGettingLocation ? <><Loader2 className="w-5 h-5 animate-spin"/> 위치 확인 중...</> : '현재 위치로 설정'}
                </button>
              </div>
              {localAddressData.subRegion && (
                <p className="mt-2 text-sm text-green-400">
                  ✓ 현재 설정된 지역: {localAddressData.subRegion}
                </p>
              )}
            </div>
          </div>

          {/* 휴대폰 번호 정보 */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3"><Phone className="w-6 h-6 text-purple-400"/>휴대폰 번호</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">휴대폰 번호</label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isPhoneVerified}
                    className="block w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white disabled:bg-white/10"
                  />
                  {!isPhoneVerified && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSendPhoneCode}
                        disabled={phoneLoading || signupLoading}
                        className="px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        {phoneLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (isPhoneUpdateInitiated ? '재전송' : '인증 요청')}
                      </button>
                      {isPhoneUpdateInitiated && (
                        <button
                          type="button"
                          onClick={resetPhoneVerification}
                          className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-gray-500 whitespace-nowrap"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  )}
                  {isPhoneVerified && (
                    <span className="inline-flex items-center px-4 py-3 bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-medium rounded-lg whitespace-nowrap">
                      <CheckCircle className="w-5 h-5 mr-2"/> 인증 완료
                    </span>
                  )}
                </div>
              </div>

              {isPhoneUpdateInitiated && !isPhoneVerified && (
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4"/>인증번호</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      id="verificationCode"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="6자리 숫자 입력"
                      className="block w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPhoneCode}
                      disabled={phoneLoading}
                      className="px-4 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-rose-500 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {phoneLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : '인증 확인'}
                    </button>
                  </div>
                </div>
              )}
              <div id="recaptcha-container" className="mt-4"></div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="submit"
              disabled={loading || signupLoading}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-bold rounded-lg shadow-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-6 h-6 animate-spin"/> 저장 중...</> : '프로필 업데이트'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
