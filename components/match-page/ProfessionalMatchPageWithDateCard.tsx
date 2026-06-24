'use client';

import dynamic from 'next/dynamic';
import { createElement } from 'react';
import type { MatchPageData } from '@/lib/match-page/types';

const MatchPageClientOnly = dynamic(() => import('./ProfessionalMatchPageClient'), {
  ssr: false,
  loading: () => createElement('main', { className: 'min-h-screen bg-[#04110D] p-6 text-center text-white' }, 'Loading match page...'),
});

export default function ProfessionalMatchPageWithDateCard(props: { data: MatchPageData }) {
  return createElement(MatchPageClientOnly, { data: props.data });
}
