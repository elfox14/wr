import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'أكاديمية MC PRIME Exchange | استراتيجيات التداول الرياضي الافتراضي',
  description: 'تعلم كيفية بناء محفظة افتراضية، تحليل المنتخبات واللاعبين، إدارة المخاطر، واستغلال فرص السوق داخل بورصة المونديال.',
  alternates: {
    canonical: '/articles',
  },
  openGraph: {
    title: 'أكاديمية MC PRIME Exchange | استراتيجيات التداول الرياضي الافتراضي',
    description: 'تعلم كيفية بناء محفظة افتراضية، تحليل المنتخبات واللاعبين، إدارة المخاطر، واستغلال فرص السوق داخل بورصة المونديال.',
    images: ['/og-image.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'أكاديمية MC PRIME Exchange | استراتيجيات التداول الرياضي الافتراضي',
    description: 'تعلم كيفية بناء محفظة افتراضية، تحليل المنتخبات واللاعبين، إدارة المخاطر، واستغلال فرص السوق داخل بورصة المونديال.',
    images: ['/og-image.jpg'],
  }
};

import React from 'react';
import { getAllArticles } from '@/lib/articles';
import Link from 'next/link';
import { Newspaper, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { AcademyClient } from '@/components/AcademyClient';

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors mb-8">
          <ArrowRight size={20} /> العودة للصفحة الرئيسية
        </Link>
        
        <PageHeader 
          title="أكاديمية MC PRIME Exchange"
          description="تعلم استراتيجيات التداول الرياضي الافتراضي، تحليل المنتخبات واللاعبين، وإدارة محفظتك داخل بورصة المونديال."
          icon={<Newspaper size={48} />}
          glowColor="bg-primary/10"
          textColor="text-primary"
        />

        <div className="mt-8">
          <AcademyClient initialArticles={articles} />
        </div>
      </main>
    </div>
  );
}

