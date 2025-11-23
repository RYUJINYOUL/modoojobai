// Header2.tsx
"use client";
import React, { useEffect, useState, useRef } from "react";
import Logo from "./Logo";
import Menu from "@/components/ui/Menu";
import Navigator from "./Navigator";
import PagePadding from "./PagePadding";
import useUIState from "@/hooks/useUIState";
import { usePathname } from "next/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
} from "@/components/ui/drawer";
import { RiMenu4Line, RiUser3Line } from "react-icons/ri";
import { MdOutlineNotifications } from "react-icons/md";
import { TbMessageChatbot } from "react-icons/tb";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HeaderDrawer = ({ children }: { children: React.ReactNode }) => (
  <Drawer direction="left">
    <DrawerTrigger asChild>
      {children}
    </DrawerTrigger>
    <DrawerContent className="w-[280px] h-full">
      <DrawerTitle className="sr-only">메인 메뉴</DrawerTitle>
      <nav className="w-full h-full bg-white">
        <div className="p-6 border-b border-gray-100">
          <Logo total />
        </div>
        <div className="py-4">
          <Navigator />
        </div>
      </nav>
    </DrawerContent>
  </Drawer>
);


interface Header2Props {
  children?: React.ReactNode;
  withChildren?: boolean; // ⭐️ 추가
}

const Header2 = ({ children, withChildren = false }: Header2Props) => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const { setHomeCategory } = useUIState();
  const [isClient, setIsClient] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname === "/") {
      setHomeCategory(null);
    }
  }, [pathname, setHomeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollValue = headRef?.current?.scrollTop;
      setIsScrolled(scrollValue !== 0);
    };

    headRef?.current?.addEventListener("scroll", handleScroll);
    return () => {
      headRef?.current?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);


  return (
    <header ref={headRef} className="w-full">
      <div className="w-full pt-[15px] pb-[13px] md:py-[5px] bg-white">
        <PagePadding>
          <div className="w-full max-w-[1100px] mx-auto">
            <div className="flex items-center justify-between">
              <Logo total={isScrolled} />
              <div className="flex items-center">
                <div className="hidden lg:block">
                  <Menu total={isScrolled} />
                </div>
                <div className="flex items-center gap-4 lg:hidden">
                  <Link href="/profile">
                    <RiUser3Line
                      className={cn("text-black", isScrolled && "text-black")}
                      size={24}
                    />
                  </Link>
                  <Link href="/notification">
                    <MdOutlineNotifications
                      className={cn("text-black", isScrolled && "text-black")}
                      size={24}
                    />
                  </Link>
                  {isClient && (
                    <HeaderDrawer>
                      <div className="pr-5">
                        <RiMenu4Line
                          className={cn("text-black", isScrolled && "text-black")}
                          size={28}
                        />
                      </div>
                    </HeaderDrawer>
                  )}
                </div>
              </div>
            </div>
          </div>
        </PagePadding>
      </div>

      {/* ✅ children을 사용할지 여부를 prop으로 결정 */}
      {withChildren && <section>{children}</section>}
    </header>
  );
};

export default Header2;
