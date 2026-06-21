import type { Metadata } from 'next';
import HomeDemoCommandCenter from '@/components/home-demo/HomeDemoCommandCenter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ديمو الرئيسية الذكية | World Cup Exchange',
  description: 'صفحة ديمو مستقلة لتجربة الرئيسية الجديدة قبل اعتمادها.',
};

export default function HomeDemoPage() {
  return <HomeDemoCommandCenter />;
}
