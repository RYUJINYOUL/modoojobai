import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/themeProvider";
import ClientLayout from "@/components/ClientLayout";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";


const inter = Inter({ subsets: ["latin"] });


export const metadata: Metadata = {
  title: 'jobAi',
  description: 'jobAi',
  keywords: '구인구직',
  openGraph: {
    title: 'jobAi',
    description: 'jobAi',
    locale: 'ko_KR',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/Image/logo.png', type: 'image/png' },
    ],
    shortcut: ['/Image/logo.png'],
    apple: [
      { url: '/Image/logo.png' },
    ],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
    other: {
      'naver-site-verification': process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || '',
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko"
     suppressHydrationWarning>
       <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
      <ServiceWorkerRegister />
      <ClientLayout>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
            {/* <FabButton /> */}
        </ClientLayout>
          </body>
    </html>
  );
}
