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

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "MC PRIME Exchange | Football Intelligence Exchange",
    template: "%s | MC PRIME Exchange",
  },
  description: "منصة ذكاء كروي وسوق رياضي افتراضي لكأس العالم: تقارير منتخبات، منهجية تسعير، قيمة عادلة، زخم، طلب، ومحفظة بأرصدة افتراضية فقط.",
  keywords: ["MC PRIME Exchange", "بورصة المونديال", "تحليل كروي", "منهجية التسعير", "سوق رياضي افتراضي", "كأس العالم", "fantasy exchange", "football intelligence"],
  authors: [{ name: "MC PRIME Exchange Team" }],
  openGraph: {
    title: "MC PRIME Exchange | Football Intelligence Exchange",
    description: "تحليل كروي أولًا وسوق رياضي افتراضي ثانيًا: اقرأ التقارير، افهم التسعير، ثم راقب المنتخبات واللاعبين بأرصدة افتراضية فقط.",
    url: baseUrl,
    siteName: "MC PRIME Exchange",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "MC PRIME Exchange Football Intelligence Exchange",
      },
    ],
    locale: "ar_EG",
    alternateLocale: ["ar_SA", "ar_AE", "ar_MA", "ar_QA"],
    type: "website",
  },
  alternates: {
    canonical: '/',
  },
  twitter: {
    card: "summary_large_image",
    title: "MC PRIME Exchange | Football Intelligence Exchange",
    description: "تقارير منتخبات، منهجية تسعير، قيمة عادلة، وسوق رياضي افتراضي بأرصدة لعب فقط.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased tabular-nums`}
    >
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9147440531390790"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <NotificationProvider>
            <Navbar />
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
