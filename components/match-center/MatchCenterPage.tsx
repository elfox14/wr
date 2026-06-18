import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'صفحة المباراة | MC PRIME World Cup',
  description: 'صفحة مباراة فارغة جاهزة لإعادة التصميم.',
};

export default async function MatchCenterPage() {
  return (
    <main
      className="min-h-screen bg-background text-white"
      dir="rtl"
      aria-label="صفحة المباراة"
    />
  );
}
