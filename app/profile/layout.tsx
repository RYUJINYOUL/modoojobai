'use client';

import Header2 from '@/components/ui/Header2';
import ProfileLayoutContent from '@/components/profileLayoutContent';


export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header2 withChildren={false} /> {/* children 안씀 */}
      <ProfileLayoutContent>{children}</ProfileLayoutContent>
    </>
  );
}