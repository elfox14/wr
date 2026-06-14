export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  date: string;
  imageUrl: string;
  category: string;
  readingTime?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  tags?: string[];
  featured?: boolean;
  relatedAssets?: string[];
}

export const articles: Article[] = [];

export function getArticleById(id: string): Article | undefined {
  return articles.find((article) => article.id === id);
}

export function getAllArticles(): Article[] {
  return articles;
}
