import React from 'react';
import { notFound } from 'next/navigation';
import { getArticleById, getAllArticles } from '@/lib/articles';
import Link from 'next/link';
import { ArrowRight, Calendar, User, Tag, Clock, BookOpen, Coins, TrendingUp } from 'lucide-react';
import { Metadata } from 'next';
import prisma from '@/lib/prisma';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = getArticleById(id);
  
  if (!article) {
    return { title: 'مقال غير موجود' };
  }

  const imageUrl = article.imageUrl && (article.imageUrl.startsWith('http://') || article.imageUrl.startsWith('https://'))
    ? article.imageUrl
    : '/og-image.jpg';

  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: `/article/${id}`,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [{ url: imageUrl }],
      type: 'article',
      publishedTime: article.date,
      authors: [article.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [imageUrl],
    }
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const article = getArticleById(id);

  if (!article) {
    notFound();
  }

  // Query related assets if present
  let relatedDbAssets: any[] = [];
  if (article.relatedAssets && article.relatedAssets.length > 0) {
    try {
      relatedDbAssets = await prisma.asset.findMany({
        where: {
          id: {
            in: article.relatedAssets
          }
        }
      });
    } catch (err) {
      console.error("Failed to query related assets:", err);
    }
  }

  const levelLabels = {
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم'
  };

  const levelColors = {
    beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    advanced: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  };

  // Get related articles (up to 3)
  const allArticles = getAllArticles();
  const currentTags = article.tags || [];
  
  const relatedArticles = allArticles
    .filter(a => a.id !== article.id)
    .map(a => {
      let score = 0;
      if (a.category === article.category) score += 5;
      const sharedTags = (a.tags || []).filter(t => currentTags.includes(t));
      score += sharedTags.length * 2;
      return { article: a, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.article)
    .slice(0, 3);

  // Fallback to first 3 articles if no related score
  const displayRelated = relatedArticles.length > 0 
    ? relatedArticles 
    : allArticles.filter(a => a.id !== article.id).slice(0, 3);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mcprime-exchange.com';
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
      "name": "MC PRIME Exchange",
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
        <Link href="/articles" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#0FF0FC] transition-colors mb-8">
          <ArrowRight size={20} /> العودة للأكاديمية
        </Link>
        
        <article className="bg-[#1A1A1A] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="relative w-full h-[400px]">
            <img 
              src={article.imageUrl} 
              alt={article.title} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="bg-[#0FF0FC]/20 text-[#0FF0FC] border border-[#0FF0FC]/30 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Tag size={14} /> {article.category}
                </span>
                {article.level && (
                  <span className={`border text-xs px-2.5 py-1 rounded-full font-bold ${levelColors[article.level]}`}>
                    {levelLabels[article.level]}
                  </span>
                )}
                {article.readingTime && (
                  <span className="bg-white/5 border border-white/10 text-xs px-2.5 py-1 rounded-full text-gray-300 flex items-center gap-1">
                    <Clock size={12} className="text-[#0FF0FC]" /> {article.readingTime}
                  </span>
                )}
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

            {/* Related Assets Section */}
            {relatedDbAssets && relatedDbAssets.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-[#0FF0FC]" size={18} /> أصول ذات صلة للتداول الافتراضي
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {relatedDbAssets.map((asset) => {
                    const isPositive = asset.change >= 0;
                    return (
                      <div key={asset.id} className="bg-black/40 border border-white/5 hover:border-[#0FF0FC]/40 rounded-2xl p-4 flex flex-col justify-between transition-all group/asset-card">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-3xl">{asset.image || '⚽'}</span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-white text-sm truncate">{asset.name}</h4>
                            <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                              {asset.type === 'TEAM' ? 'منتخب' : 'لاعب'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
                          <div>
                            <p className="text-[10px] text-gray-500">السعر الحالي</p>
                            <p className="text-xs font-bold text-[#FFD700] flex items-center gap-0.5">
                              {asset.current_price} <span className="text-[9px] text-gray-400">كوين</span>
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] text-gray-500">التغيير (24س)</p>
                            <p className={`text-xs font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? '+' : ''}{asset.change}%
                            </p>
                          </div>
                        </div>
                        <Link 
                          href={`/asset/${asset.id}`}
                          className="w-full mt-4 py-2 bg-[#0FF0FC]/10 hover:bg-[#0FF0FC] text-[#0FF0FC] hover:text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all duration-300 border border-[#0FF0FC]/20 hover:border-[#0FF0FC]"
                        >
                          تداول الآن
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Quick-Navigation for Knockout Stage Article */}
            {article.id === 'knockout-stage-strategy' && (
              <div className="mt-12 pt-8 border-t border-white/5 space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-[#0FF0FC]" size={18} /> روابط سريعة للمتابعة
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link href="/groups" className="bg-black/40 border border-white/5 hover:border-[#0FF0FC]/40 rounded-2xl p-5 block transition-all group/nav text-right">
                    <h4 className="font-bold text-white text-base group-hover/nav:text-[#0FF0FC] transition-colors mb-2">جدول المجموعات وحسابات التأهل</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">تابع ترتيب المجموعات ونسب صعود المنتخبات لتحديد أفضل فرص الشراء والبيع الافتراضي.</p>
                    <span className="text-[11px] text-[#0FF0FC] mt-4 inline-flex items-center gap-1 font-bold">
                      عرض المجموعات <ArrowRight size={12} />
                    </span>
                  </Link>
                  <Link href="/matches" className="bg-black/40 border border-white/5 hover:border-[#0FF0FC]/40 rounded-2xl p-5 block transition-all group/nav text-right">
                    <h4 className="font-bold text-white text-base group-hover/nav:text-[#0FF0FC] transition-colors mb-2">جدول المباريات والنتائج المباشرة</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">تابع مواعيد مباريات خروج المغلوب وحلل أداء المنتخبات لتعديل محفظتك الافتراضية قبل الصافرة.</p>
                    <span className="text-[11px] text-[#0FF0FC] mt-4 inline-flex items-center gap-1 font-bold">
                      عرض المباريات <ArrowRight size={12} />
                    </span>
                  </Link>
                </div>
              </div>
            )}

            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-6 mt-8 border-t border-white/5">
                {article.tags.map((tag) => (
                  <span key={tag} className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* CTA Box */}
        <div className="mt-8 bg-gradient-to-r from-[#1A1A1A] to-black border border-[#0FF0FC]/20 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC]/5 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-2 text-right">
              <h3 className="text-2xl font-black text-white">طبّق ما تعلمته الآن</h3>
              <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
                افتح السوق وابدأ اختبار استراتيجيتك بعملات افتراضية داخل MC PRIME Exchange.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 shrink-0">
              <Link 
                href="/market" 
                className="px-6 py-3 bg-[#0FF0FC] text-black font-bold rounded-xl text-sm hover:bg-[#0FF0FC]/90 transition-all shadow-[0_0_15px_rgba(15,240,252,0.2)] inline-flex items-center gap-2"
              >
                <TrendingUp size={16} /> افتح السوق
              </Link>
              <Link 
                href="/rewards" 
                className="px-6 py-3 bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700] font-bold rounded-xl text-sm hover:bg-[#FFD700] hover:text-black transition-all inline-flex items-center gap-2"
              >
                <Coins size={16} /> اكسب كوينز
              </Link>
            </div>
          </div>
        </div>

        {/* Related Articles */}
        {displayRelated.length > 0 && (
          <div className="mt-12 space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2 pb-3 border-b border-white/5">
              <BookOpen size={20} className="text-[#0FF0FC]" /> مقالات ذات صلة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {displayRelated.map((related) => (
                <Link 
                  href={`/article/${related.id}`} 
                  key={related.id} 
                  className="group bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden hover:border-[#0FF0FC]/30 transition-all hover:-translate-y-1"
                >
                  <div className="h-32 relative overflow-hidden">
                    <img 
                      src={related.imageUrl} 
                      alt={related.title} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-2 right-2 z-10">
                      <span className="bg-black/80 backdrop-blur-sm text-[#0FF0FC] text-[9px] px-2 py-0.5 rounded border border-white/10 font-bold">
                        {related.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="font-bold text-sm text-white group-hover:text-[#0FF0FC] transition-colors line-clamp-2 leading-snug">
                      {related.title}
                    </h4>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {related.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Safety Disclaimer */}
        <div className="mt-12 p-4 bg-black/45 border border-white/5 rounded-2xl text-center text-xs text-gray-500 leading-relaxed">
          جميع الكوينز والأصول داخل المنصة افتراضية بالكامل، ولا تمثل تداولاً حقيقياً أو نصيحة مالية.
        </div>
      </main>
    </div>
  );
}

