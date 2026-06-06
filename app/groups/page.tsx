import { Metadata } from 'next';
import GroupsClient from '@/components/GroupsClient';

export const metadata: Metadata = {
  title: 'المجموعات | WorldCup Exchange',
  description: 'استعرض المنتخبات المشاركة مقسمة حسب مجموعات كأس العالم.',
};

export default function GroupsPage() {
  return <GroupsClient />;
}
