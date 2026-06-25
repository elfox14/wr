import type { Metadata } from 'next';
import GroupsHubClient from '@/components/groups/GroupsHubClient';

export const metadata: Metadata = {
  title: 'المجموعات والترتيب | MC PRIME Exchange',
  description: 'استعرض مجموعات كأس العالم والترتيب والنتائج والمباريات القادمة.',
};

export default function GroupsPage() {
  return <GroupsHubClient />;
}
