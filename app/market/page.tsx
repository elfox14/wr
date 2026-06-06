import { Metadata } from 'next';
import MarketClient from '@/components/MarketClient';

export const metadata: Metadata = {
  title: 'سوق كأس العالم | WorldCup Exchange',
  description: 'استكشف المنتخبات واللاعبين، وقارن بين أسعارهم وحركتهم في سوق تداول المونديال.',
};

export default function MarketPage() {
  return <MarketClient />;
}
