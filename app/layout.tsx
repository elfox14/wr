import Script from "next/script";
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import { GlobalTicker } from "@/components/ui/GlobalTicker";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "MC PRIME Exchange | منصة تداول كرة القدم الافتراضية",
    template: "%s | MC PRIME Exchange",
  },
  description: "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. حلل الأداء، قم بالتداول الافتراضي للنجوم، ونافس على صدارة السوق العالمي.",
  keywords: ["كأس العالم", "تداول كرة القدم", "أسهم اللاعبين", "تداول رياضي افتراضي", "فانتازي كأس العالم", "MC PRIME Exchange", "تحليلات رياضية", "بورصة كرة القدم"],
  authors: [{ name: "MC PRIME Exchange Team" }],
  openGraph: {
    title: "MC PRIME Exchange | منصة تداول كرة القدم الافتراضية",
    description: "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. استثمر في النجوم ونافس عالمياً.",
    url: baseUrl, // Replace with real domain later
    siteName: "MC PRIME Exchange",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "MC PRIME Exchange",
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
    title: "MC PRIME Exchange | منصة تداول كرة القدم الافتراضية",
    description: "تداول أسهم المنتخبات واللاعبين بناءً على أدائهم في كأس العالم.",
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
            <div className="pb-10 min-h-[calc(100vh-100px)]"> {/* Padding bottom for the fixed ticker */}
              {children}
            </div>
            <Footer />
            <GlobalTicker />
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  );
}
