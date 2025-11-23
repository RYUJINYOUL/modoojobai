// 기존 코드 유지
import { createSlice, current } from "@reduxjs/toolkit";
import { getSafeLocalStorage } from '../utils/localStorage';

// 1. initialState에 userType 추가
const initialState = {
    currentUser: {
        uid: getSafeLocalStorage('uid'),
        photoURL: getSafeLocalStorage("photoURL"),
        displayName: getSafeLocalStorage('displayName'),
        userType: getSafeLocalStorage('userType'), // 💡 userType 필드 추가
        subRegion: getSafeLocalStorage('subRegion'),
    }
}

export const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action) => {
            state.currentUser.uid = action.payload.uid;
            state.currentUser.photoURL = action.payload.photoURL;
            state.currentUser.displayName = action.payload.displayName;
            // 💡 userType 처리 로직 추가
            state.currentUser.userType = action.payload.userType; 
            state.currentUser.subRegion = action.payload.subRegion; 

            // 로컬 스토리지에 저장할 변수들
            let uid = JSON.stringify(state.currentUser.uid);
            let photoURL = JSON.stringify(state.currentUser.photoURL);
            let displayName = JSON.stringify(state.currentUser.displayName);
            let userType = JSON.stringify(state.currentUser.userType); // 💡 userType 저장
            let subRegion = JSON.stringify(state.currentUser.subRegion);

            localStorage.setItem("uid", uid);
            localStorage.setItem("photoURL", photoURL);
            localStorage.setItem("displayName", displayName);
            localStorage.setItem("userType", userType); // 💡 로컬 스토리지에 userType 저장
            localStorage.setItem("subRegion", subRegion)
        },
        clearUser: (state) => {
            state.currentUser = {
                uid: '',
                photoURL: '',
                displayName: '',
                userType: '', // 💡 userType 초기화
                subRegion: ''
            };
            if (typeof window !== 'undefined') {
                localStorage.removeItem("uid");
                localStorage.removeItem("photoURL");
                localStorage.removeItem("displayName");
                localStorage.removeItem("userType"); // 💡 userType 제거
                localStorage.removeItem("subRegion");
            }
        },
        // ... (나머지 reducers 유지)
    }
})

export const { setUser, clearUser, setPhotoUrl } = userSlice.actions;
export default userSlice.reducer;