"use client"
import React, { useRef, useState, useEffect } from "react";
import useUIState from "@/hooks/useUIState";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { getAuth, signOut } from 'firebase/auth';
import app from '../../firebase';
import { clearUser } from '../../store/userSlice';
import { FiLogIn, FiLogOut } from 'react-icons/fi';
import { RiUser3Line } from "react-icons/ri";
import { Briefcase, FileText } from "lucide-react";
import { TbMessageChatbot } from "react-icons/tb";
import { MdOutlineNotifications } from "react-icons/md";


export default function Menu(props) {
  const { push, refresh } = useRouter();
  const pathname = usePathname();
  const { homeCategory, setHomeCategory, setHeaderSrc } = useUIState();
  const previousSrcRef = useRef(null);
  const dispatch = useDispatch();
  const auth = getAuth(app);
  const currentUser = useSelector((state) => state.user.currentUser);
  const [mounted, setMounted] = useState(false);  

  useEffect(() => {
    setMounted(true);  // 추가
  }, []);

  let total = props;
  const allHomeCategoryList = [
    {
      label: "이력서",
      src: "/resume",
      icon: Briefcase,
      iconSize: 22,
      userType: 'individual' // 개인 회원 전용
    },
    { 
      label: "내정보", 
      src: "/profile",
      icon: RiUser3Line,
      iconSize: 20,
      userType: 'all' // 모든 사용자
    },
     { 
      label: "알림", 
      src: "/notification",
      icon: MdOutlineNotifications,
      iconSize: 20,
      userType: 'all' // 모든 사용자
    },
  ];

  const [homeCategoryList, setHomeCategoryList] = useState(allHomeCategoryList);

  useEffect(() => {
    // 클라이언트에서만 실행되도록 하여 Hydration 오류 방지
    const isEnterprise = currentUser?.userType === 'enterprise';
    const filteredList = allHomeCategoryList.filter(item => {
      if (item.userType === 'all') return true;
      if (item.userType === 'individual' && !isEnterprise) return true;
      return false;
    });
    setHomeCategoryList(filteredList);
  }, [currentUser]);
  
  const onClickCategory = (item) => {
    if (homeCategory === item.label) {
      setHeaderSrc("");
      setHomeCategory(item.label);
    } else {
      setHeaderSrc(item.src);
      setHomeCategory(item.label);
      push(item.src, { scroll: false });
    }
  };

  const handleLogout = () => {
    signOut(auth)
      .then(() => {
        dispatch(clearUser());
        refresh();
      })
      .catch((err) => {
        console.error('로그아웃 에러:', err);
      });
  };

  

  return (
    <nav id="nav" className="flex items-center w-full+10 md:m-0 md:px-60 ml-5 pr-4 md:pr-0 overflow-x-auto">
      {homeCategoryList.map((item, i) => (
        <div
          onClick={() => item.isExternal ? window.open(item.src, '_blank', 'noopener,noreferrer') : onClickCategory(item)}
          key={item.label}
          id={i}
          className={cn(
            "md:h-[62px] h-[55px] md:text-[16px] text-[15px] text-black min-w-fit px-2 flex justify-center items-center cursor-pointer",
            total.total && "md:text-black text-[#ffffff80]",
            pathname !== "/" && "lg:text-black",
            item.label === homeCategory && "underline underline-offset-8 md:text-[17px] text-[15px] text-black font-medium",
            pathname === "/" && total.total && "lg:text-black"
          )}
        >
          {item.icon ? (
            <item.icon size={item.iconSize} className={cn(
              "text-gray-700",
              total.total && "md:text-black text-[#ffffff80]",
              pathname !== "/" && "lg:text-black"
            )} />
          ) : (
            item.label
          )}
        </div>
      ))}
      <div className="flex items-center pl-4 sticky right-1">
        {mounted && (  // 추가: mounted 상태 확인
          <button
            onClick={currentUser?.uid ? handleLogout : () => push('/login')}
            className={cn(
              "text-[13px] cursor-pointer px-3 py-1.5 rounded-md transition-colors",
              "bg-green-600 hover:bg-green-700 text-white font-medium"
            )}
          >
            {currentUser?.uid ? '로그아웃' : '로그인'}
          </button>
        )}
      </div>
    </nav>
  );
}
