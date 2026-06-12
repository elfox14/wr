import { Suspense } from "react";
import Script from "next/script";
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import "./brand-logo.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import { GlobalTicker } from "@/components/ui/GlobalTicker";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { MobileBottomNav } from "@/components/ui/MobileBottomNav";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
const bilingualDescription = 'بورصة المونديال من MC PRIME: مباريات كأس العالم مباشرة، أخبار موثقة، تحليل كروي، صفحات منتخبات ولاعبين، وبورصة افتراضية ترفيهية للتفاعل الجماهيري. World Cup Exchange by MC PRIME: live matches, verified news, football analysis, team and player hubs, and a virtual fan exchange experience.';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "بورصة المونديال | World Cup Exchange — مباشر وتحليل كأس العالم",
    template: "%s | بورصة المونديال — World Cup Exchange",
  },
  description: bilingualDescription,
  keywords: ["بورصة المونديال", "كأس العالم", "مباشر كأس العالم", "أخبار كأس العالم", "تحليل كروي", "منتخبات كأس العالم", "لاعبو كأس العالم", "سوق رياضي افتراضي", "World Cup Exchange", "live World Cup matches", "football analysis", "football intelligence"],
  authors: [{ name: "MC PRIME Exchange Team" }],
  openGraph: {
    title: "بورصة المونديال | World Cup Exchange — مباشر وتحليل كأس العالم",
    description: bilingualDescription,
    url: baseUrl,
    siteName: "بورصة المونديال | World Cup Exchange",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "بورصة المونديال World Cup Exchange live matches and football analysis" }],
    locale: "ar_EG",
    alternateLocale: ["en_US", "ar_SA", "ar_AE", "ar_MA", "ar_QA"],
    type: "website",
  },
  alternates: { canonical: '/', languages: { ar: '/', en: '/' } },
  twitter: {
    card: "summary_large_image",
    title: "بورصة المونديال | World Cup Exchange",
    description: bilingualDescription,
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased tabular-nums`}>
      <head>
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9147440531390790" crossOrigin="anonymous" strategy="afterInteractive" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <NotificationProvider>
            <Suspense fallback={<div className="h-16 lg:h-20" />}>
              <Navbar />
            </Suspense>
            <div className="pb-28 lg:pb-10 min-h-[calc(100vh-100px)]">
              {children}
            </div>
            <Footer />
            <MobileBottomNav />
            <GlobalTicker />
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  );
}
