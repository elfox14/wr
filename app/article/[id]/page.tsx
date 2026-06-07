import React from 'react';
import { notFound } from 'next/navigation';
import { getArticleById } from '@/lib/articles';
import Link from 'next/link';
import { ArrowRight, Calendar, User, Tag } from 'lucide-react';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = getArticleById(id);
  
  if (!article) {
    return { title: 'مقال غير موجود' };
  }

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [{ url: '/og-image.jpg' }],
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: ['/og-image.jpg'],
    }
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const article = getArticleById(id);

  if (!article) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://worldcup.mcprim.com';
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.excerpt,
    "image": article.imageUrl,
    "author": {
      "@type": "Person",
      "name": article.author
    },
    "datePublished": article.date,
    "publisher": {
      "@type": "Organization",
      "name": "WorldCup Exchange",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/og-image.jpg`
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
            
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#0FF0FC] transition-colors mb-8">
          <ArrowRight size={20} /> العودة للصفحة الرئيسية
        </Link>
        
        <article className="bg-[#1A1A1A] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="relative w-full h-[400px]">
            {/* We use standard img to avoid Next.js external domain image configuration errors */}
            <img 
              src={article.imageUrl} 
              alt={article.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#0FF0FC]/20 text-[#0FF0FC] border border-[#0FF0FC]/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Tag size={14} /> {article.category}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-white">
                {article.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <User size={16} />
                  بقلم: <span className="text-gray-200">{article.author}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} />
                  نشر في: <span className="text-gray-200">{new Date(article.date).toLocaleDateString('ar-SA')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-8 md:p-12">
            <p className="text-xl text-gray-300 font-bold leading-relaxed mb-8 border-r-4 border-[#0FF0FC] pr-4">
              {article.excerpt}
            </p>
            
            <div 
              className="prose prose-invert prose-lg max-w-none 
                prose-headings:text-white prose-headings:font-bold prose-h2:text-3xl prose-h2:mb-6 prose-h2:mt-12
                prose-h3:text-2xl prose-h3:mb-4 prose-h3:mt-8 prose-h3:text-[#FFD700]
                prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-6
                prose-li:text-gray-300 prose-ul:mb-6
                prose-strong:text-white"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </article>
      </main>
    </div>
  );
}
