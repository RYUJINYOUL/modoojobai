"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import app from "../../firebase";
import useUIState from "@/hooks/useUIState";
import { cn } from "@/lib/utils";
import { useSelector } from 'react-redux';


export default function Navigator() {
  const { push } = useRouter();
  const auth = getAuth(app);
  const currentUser = useSelector((state) => state.user.currentUser);

  const { homeCategory, setHomeCategory, setHeaderSrc } = useUIState();



  const homeCategoryList = [
    { label: "모두잡", src: "/" },
    { label: "내정보", src: "/profile" },
  ];

  const onClickCategory = (item) => {
    if (homeCategory === item.label) {
      setHeaderSrc("");
      setHomeCategory(item.label);
    } else {
      setHeaderSrc(item.src);
      setHomeCategory(item.label);
    }
    push(item.src, { scroll: false });
  };

  const handleLogin = () => {
    push("/login", { scroll: false });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      push("/login", { scroll: false });
    } catch (err) {
      console.error("로그아웃 실패:", err);
    }
  };

  return (
    <div>
      <section className="flex flex-row px-6 py-3 gap-4 border-b border-gray-100">
        <button
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          onClick={currentUser ? handleLogout : handleLogin}
        >
          {currentUser ? "로그아웃" : "로그인"}
        </button>
        <div className="text-gray-300">|</div>
        <button
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          onClick={() => push("/register", { scroll: false })}
        >
          회원가입
        </button>
      </section>

      <section className="flex flex-col py-2">
        {homeCategoryList.map((item) => (
          <div
            onClick={() => onClickCategory(item)}
            key={item.label}
            className={cn(
              "h-11 text-gray-600 px-6 flex items-center text-[15px] hover:bg-gray-50 transition-all duration-200 cursor-pointer relative group",
              item.label === homeCategory && "text-gray-900 bg-gray-50/80 font-medium after:absolute after:left-0 after:w-1 after:h-6 after:bg-gray-900 after:rounded-r-full after:top-1/2 after:-translate-y-1/2"
            )}
          >
            <span className="relative">
              {item.label}
              <span className="absolute left-0 right-0 bottom-0 h-px bg-gray-900 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"/>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}