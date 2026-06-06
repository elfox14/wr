import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { NotificationProvider } from "@/components/ui/NotificationProvider";
import { GlobalTicker } from "@/components/ui/GlobalTicker";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "WorldCup Exchange | منصة تداول كرة القدم الافتراضية",
    template: "%s | WorldCup Exchange",
  },
  description: "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. حلل الأداء، استثمر في النجوم، ونافس على صدارة السوق العالمي.",
  keywords: ["كأس العالم", "تداول كرة القدم", "أسهم اللاعبين", "استثمار رياضي", "فانتازي كأس العالم", "WorldCup Exchange", "تحليلات رياضية", "بورصة كرة القدم"],
  authors: [{ name: "WorldCup Exchange Team" }],
  openGraph: {
    title: "WorldCup Exchange | منصة تداول كرة القدم الافتراضية",
    description: "أول منصة لتداول أسهم منتخبات ولاعبي كأس العالم افتراضياً. استثمر في النجوم ونافس عالمياً.",
    url: baseUrl, // Replace with real domain later
    siteName: "WorldCup Exchange",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WorldCup Exchange",
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
    title: "WorldCup Exchange | منصة تداول كرة القدم الافتراضية",
    description: "تداول أسهم المنتخبات واللاعبين بناءً على أدائهم في كأس العالم.",
    images: ["/og-image.png"],
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
      <body className="min-h-full flex flex-col">
        <Providers>
          <NotificationProvider>
            <div className="pb-10"> {/* Padding bottom for the fixed ticker */}
              {children}
            </div>
            <GlobalTicker />
          </NotificationProvider>
        </Providers>
      </body>
    </html>
  );
}
