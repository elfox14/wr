'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, User, Tag, BookOpen, Clock, BarChart, ChevronLeft, Filter } from 'lucide-react';
import { Article } from '@/lib/articles';

interface AcademyClientProps {
  initialArticles: Article[];
}

export function AcademyClient({ initialArticles }: AcademyClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  const categories = [
    'الكل',
    'دليل المبتدئين',
    'استراتيجيات التداول',
    'تحليل المنتخبات',
    'تحليلات اللاعبين',
    'إدارة المخاطر',
    'أخبار السوق'
  ];

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

  // Find featured article (featured === true) or fallback to first
  const featuredArticle = initialArticles.find(a => a.featured) || initialArticles[0];

  // Filter articles
  const filteredArticles = initialArticles.filter(article => {
    // Category filter
    if (selectedCategory !== 'الكل' && article.category !== selectedCategory) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchesTitle = article.title.toLowerCase().includes(query);
      const matchesExcerpt = article.excerpt.toLowerCase().includes(query);
      const matchesCategory = article.category.toLowerCase().includes(query);
      const matchesTags = article.tags?.some(tag => tag.toLowerCase().includes(query)) || false;

      return matchesTitle || matchesExcerpt || matchesCategory || matchesTags;
    }

    return true;
  });

  // Decide if we show the featured banner: only if no search query and category is 'الكل'
  const showFeaturedBanner = searchQuery.trim() === '' && selectedCategory === 'الكل' && featuredArticle;

  // If featured banner is shown, exclude it from the grid below
  const gridArticles = showFeaturedBanner
    ? filteredArticles.filter(a => a.id !== featuredArticle.id)
    : filteredArticles;

  return (
    <div className="space-y-12">
      {/* 1. SEARCH & CATEGORIES CONTROLS */}
      <div className="bg-surface/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 right-4 flex items-center pr-1 pointer-events-none text-gray-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="ابحث في الأكاديمية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-12 py-3 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 transition-all text-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-4 flex items-center text-xs text-gray-500 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Filter size={14} className="text-primary" />
            <span>تم العثور على {filteredArticles.length} مقال تحليلي</span>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(15,240,252,0.1)]'
                  : 'bg-black/20 border-white/5 text-gray-400 hover:text-white hover:border-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* 2. FEATURED ARTICLE BANNER */}
      {showFeaturedBanner && (
        <section className="relative rounded-3xl border border-white/5 overflow-hidden bg-surface group shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent lg:bg-gradient-to-r lg:from-black lg:via-black/75 lg:to-transparent z-10" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative min-h-[420px]">
            {/* Image on left for large, top for mobile */}
            <div className="lg:col-span-6 lg:order-last h-64 lg:h-auto relative overflow-hidden">
              <img
                src={featuredArticle.imageUrl}
                alt={featuredArticle.title}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* Info details */}
            <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center z-20 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-primary/20 text-primary border border-primary/30 text-xs px-3 py-1 rounded-lg font-bold">
                  {featuredArticle.category}
                </span>
                {featuredArticle.level && (
                  <span className={`border text-[10px] px-2 py-0.5 rounded-md font-bold ${levelColors[featuredArticle.level]}`}>
                    {levelLabels[featuredArticle.level]}
                  </span>
                )}
                {featuredArticle.readingTime && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                    <Clock size={12} className="text-primary" /> {featuredArticle.readingTime}
                  </span>
                )}
              </div>

              <h2 className="text-2xl lg:text-4xl font-black text-white leading-tight group-hover:text-primary transition-colors">
                {featuredArticle.title}
              </h2>

              <p className="text-gray-400 text-sm lg:text-base leading-relaxed line-clamp-3">
                {featuredArticle.excerpt}
              </p>

              {featuredArticle.tags && featuredArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {featuredArticle.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="text-[10px] text-gray-500 bg-black/30 px-2.5 py-1 rounded-md border border-white/5">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                    {featuredArticle.author[0]}
                  </div>
                  <div className="text-xs">
                    <p className="text-white font-bold">{featuredArticle.author}</p>
                    <p className="text-gray-500">{new Date(featuredArticle.date).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>

                <Link
                  href={`/article/${featuredArticle.id}`}
                  className="px-6 py-2.5 bg-primary text-black font-bold rounded-xl text-xs hover:bg-primary/90 transition-all inline-flex items-center gap-1"
                >
                  اقرأ المقال <ChevronLeft size={16} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. ARTICLES GRID */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-16 bg-surface/35 border border-white/5 rounded-3xl">
          <BookOpen className="mx-auto text-gray-600 mb-4" size={48} />
          <h3 className="text-lg font-bold text-white mb-2">لا توجد نتائج مطابقة</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            لم نجد أي مقال يطابق بحثك "{searchQuery}". حاول استخدام كلمات دلالية أخرى أو تصنيف مختلف.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {showFeaturedBanner && (
            <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-white/5 pb-3">
              <BookOpen size={18} className="text-primary" /> مقالات أخرى مميزة
            </h3>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridArticles.map((article) => (
              <div
                key={article.id}
                className="group flex flex-col h-full bg-surface border border-white/5 rounded-3xl overflow-hidden hover:border-primary/40 transition-all duration-300 hover:-translate-y-1.5 shadow-card hover:shadow-[0_12px_30px_rgba(15,240,252,0.05)]"
              >
                {/* Image Section */}
                <div className="h-48 w-full relative overflow-hidden shrink-0">
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all z-10" />
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4 z-20 flex flex-wrap gap-1">
                    <span className="bg-black/70 backdrop-blur-md text-primary text-[10px] px-2.5 py-1 rounded-lg font-bold border border-white/10">
                      {article.category}
                    </span>
                    {article.level && (
                      <span className={`backdrop-blur-md text-[10px] px-2.5 py-1 rounded-lg font-bold border ${levelColors[article.level].replace('bg-', 'bg-black/70 ').replace('text-', 'text-')}`}>
                        {levelLabels[article.level]}
                      </span>
                    )}
                  </div>
                  
                  {article.readingTime && (
                    <div className="absolute bottom-4 right-4 z-20">
                      <span className="bg-black/75 backdrop-blur-md text-[10px] text-gray-300 px-2 py-1 rounded-md border border-white/5 flex items-center gap-1">
                        <Clock size={10} className="text-primary" /> {article.readingTime}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-6 flex flex-col flex-1">
                  <h4 className="text-lg font-bold mb-3 text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {article.title}
                  </h4>
                  
                  <p className="text-gray-400 text-xs mb-6 line-clamp-3 leading-relaxed flex-1">
                    {article.excerpt}
                  </p>

                  {article.tags && article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[9px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-4 border-t border-white/5 mt-auto">
                    <span className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-gray-400 text-[9px]">{article.author[0]}</span>
                      بقلم: <span className="text-gray-300 font-bold">{article.author}</span>
                    </span>
                    <span>{new Date(article.date).toLocaleDateString('ar-SA')}</span>
                  </div>

                  <div className="pt-4 mt-2">
                    <Link
                      href={`/article/${article.id}`}
                      className="w-full py-2 bg-white/5 group-hover:bg-primary text-gray-300 group-hover:text-black font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all duration-300 border border-white/5 group-hover:border-primary"
                    >
                      اقرأ المقال <ChevronLeft size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
