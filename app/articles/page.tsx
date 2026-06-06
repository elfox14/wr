import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'جميع المقالات والتحليلات',
  description: 'المكتبة الشاملة لاستراتيجيات التداول، أخبار المونديال، وتحليل أداء المنتخبات واللاعبين في كأس العالم.',
  alternates: {
    canonical: '/articles',
  },
  openGraph: {
    title: 'جميع المقالات والتحليلات | WorldCup Exchange',
    description: 'استراتيجيات تداول وتحليلات كأس العالم.',
    images: ['/og-image.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'جميع المقالات والتحليلات | WorldCup Exchange',
    description: 'استراتيجيات تداول وتحليلات كأس العالم.',
    images: ['/og-image.jpg'],
  }
};

import React from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { getAllArticles } from '@/lib/articles';
import Link from 'next/link';
import { Newspaper } from 'lucide-react';

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-10 border-b border-white/10 pb-6">
          <div className="p-3 bg-[#0FF0FC]/10 rounded-xl">
            <Newspaper size={32} className="text-[#0FF0FC]" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">جميع المقالات والتحليلات</h1>
            <p className="text-gray-400 mt-1">المكتبة الشاملة لاستراتيجيات التداول وأخبار المونديال</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => (
            <Link href={`/article/${article.id}`} key={article.id} className="group flex flex-col h-full bg-[#1A1A1A] rounded-3xl border border-white/5 overflow-hidden hover:border-[#0FF0FC]/50 transition-all hover:-translate-y-2 shadow-lg">
              <div className="h-48 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all z-10" />
                <img 
                  src={article.imageUrl} 
                  alt={article.title} 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 z-20">
                  <span className="bg-black/70 backdrop-blur-md text-[#0FF0FC] text-xs px-3 py-1 rounded-full font-bold border border-white/10">
                    {article.category}
                  </span>
                </div>
              </div>
              
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold mb-3 text-white group-hover:text-[#0FF0FC] transition-colors line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-gray-400 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                  {article.excerpt}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-white/5">
                  <span className="flex items-center gap-1">
                    بقلم: <span className="text-gray-300 font-bold">{article.author}</span>
                  </span>
                  <span>{new Date(article.date).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
