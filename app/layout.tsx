import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import "./brand-logo.css";
import "./match-page-overrides.css";
import "./team-display.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import { Navbar } from "@/components/ui/Navbar";
import { Footer } from "@/components/ui/Footer";
import { HardNavigationGuard } from "@/components/ui/HardNavigationGuard";



const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
const description = 'بورصة المونديال من MC PRIME: مباريات كأس العالم مباشرة، أخبار موثقة، منتخبات ولاعبون ومجموعات، وتحليل كروي مع بورصة افتراضية ترفيهية.';
const brandIcon = '/brand/borsa-mondial-sport-logo-icon.svg?v=20260616sport';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#04110D',
};

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: "بورصة المونديال | MC PRIME", template: "%s | بورصة المونديال" },
  description,
  keywords: ["كأس العالم", "بورصة المونديال", "مباريات مباشرة", "تحليل كروي", "منتخبات", "World Cup", "football news", "live matches", "teams", "players"],
  authors: [{ name: "MC PRIME Sports Exchange" }],
  icons: {
    icon: [{ url: brandIcon, type: 'image/svg+xml' }],
    shortcut: [{ url: brandIcon, type: 'image/svg+xml' }],
    apple: [{ url: brandIcon, type: 'image/svg+xml' }],
  },
  openGraph: {
    title: "بورصة المونديال | MC PRIME",
    description,
    url: baseUrl,
    siteName: "بورصة المونديال",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "بورصة المونديال" }],
    locale: "ar_EG",
    type: "website",
  },
  alternates: { canonical: '/', languages: { ar: '/', en: '/' } },
  twitter: { card: "summary_large_image", title: "بورصة المونديال | MC PRIME", description, images: ["/og-image.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased tabular-nums`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9147440531390790" crossOrigin="anonymous" strategy="afterInteractive" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[#04110D] mobile-safe-body">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[100] focus:rounded-xl focus:bg-[var(--wc-green)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#04110D]">
          تخطي إلى المحتوى
        </a>
        <Providers>
          <NotificationProvider>
            <HardNavigationGuard />
            <Navbar />
            <div id="main-content" className="min-h-[calc(100vh-180px)] min-w-0 flex-1 overflow-x-clip mobile-page-shell">{children}</div>
            <Footer />
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  );
}
