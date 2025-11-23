"use client"
import React from 'react'
import useUIState from "@/hooks/useUIState";
import { useRouter } from 'next/navigation'
import { cn } from "@/lib/utils";
import { usePathname } from 'next/navigation'

function Logo(props) {
    const { push } = useRouter();
    const pathname = usePathname()
    const { setHomeCategory} = useUIState();
    let total = props
    const onClickLogo = () =>{
      setHomeCategory("");  // ← 초기화 명확하게
      push("/", {scroll: false});
    }


  return (
    <section className='items-center'>
         <div className='cursor-pointer flex flex-row items-center gap-x-2 pl-4' onClick={onClickLogo}>
        <img
            src='/Image/logo.png'
            alt='모두잡AI 로고'
            className='h-8 w-8'
        />
        <div className={cn('font-medium md:text-[20px] text-[20px] text-black cursor-pointer whitespace-nowrap', 
            total.total && 'text-black',
        )}>
            모두잡AI
        </div>
    </div>
    </section>
  )
}

export default Logo
