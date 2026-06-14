import Script from "next/script";
import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import "./brand-logo.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import { GlobalTicker } from "@/components/ui/GlobalTicker";
import { Footer } from "@/components/ui/Footer";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
const description = 'MC PRIME World Cup: live World Cup matches, verified news, teams, players, groups, and interactive match center.';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "MC PRIME World Cup",
    template: "%s | MC PRIME World Cup",
  },
  description,
  keywords: ["World Cup", "football news", "live matches", "teams", "players"],
  authors: [{ name: "MC PRIME World Cup Team" }],
  openGraph: {
    title: "MC PRIME World Cup",
    description,
    url: baseUrl,
    siteName: "MC PRIME World Cup",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "MC PRIME World Cup" }],
    locale: "ar_EG",
    type: "website",
  },
  alternates: { canonical: '/', languages: { ar: '/', en: '/' } },
  twitter: {
    card: "summary_large_image",
    title: "MC PRIME World Cup",
    description,
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
            <div className="min-h-[calc(100vh-100px)]">
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
