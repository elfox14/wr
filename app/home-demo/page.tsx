import type { Metadata } from 'next';
import HomeDemoWithCurrentHomeCards from '@/components/home-demo/HomeDemoWithCurrentHomeCards';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ديمو الرئيسية الذكية | World Cup Exchange',
  description: 'صفحة ديمو مستقلة تعرض كروت الرئيسية الحالية أولًا ثم الإضافات المقترحة قبل الاعتماد.',
};

export default function HomeDemoPage() {
  return <HomeDemoWithCurrentHomeCards />;
}
