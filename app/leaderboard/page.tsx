import { Metadata } from 'next';
import LeaderboardClient from '@/components/LeaderboardClient';

export const metadata: Metadata = {
  title: 'ترتيب المستثمرين | MC PRIME Exchange',
  description: 'قائمة بأفضل المتداولين والمستثمرين في بورصة المونديال.',
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
