'use client';

import { useEffect } from 'react';
import ProfessionalMatchPageClient from './ProfessionalMatchPageClient';
import type { MatchPageData } from '@/lib/match-page/types';

function fullDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function cardLabel(card: Element) {
  return String(card.querySelector('span')?.textContent || '').trim();
}

function makeDateCard(value: string) {
  const card = document.createElement('div');
  card.setAttribute('data-match-date-card', 'true');
  card.className = 'min-w-0 rounded-2xl border border-white/10 bg-black/25 p-2.5 text-center sm:p-3 sm:text-right';

  const header = document.createElement('div');
  header.className = 'mb-1 flex items-center justify-center gap-1.5 text-[#18E58F] sm:justify-start';

  const icon = document.createElement('span');
  icon.textContent = '🕒';
  icon.className = 'text-[13px] leading-none';

  const label = document.createElement('span');
  label.className = 'text-[10px] font-black sm:text-xs';
  label.textContent = 'موعد المباراة';

  const body = document.createElement('p');
  body.className = 'line-clamp-2 min-h-[2.35rem] text-[10px] font-black leading-5 text-white sm:min-h-0 sm:text-sm sm:font-bold sm:leading-6';
  body.textContent = value || '—';

  header.append(icon, label);
  card.append(header, body);
  return card;
}

function arrangeInfoCards(dateText: string) {
  const header = document.querySelector('header');
  if (!header) return;

  const grids = Array.from(header.querySelectorAll('div.grid'));
  const infoGrid = grids.find((grid) => {
    const labels = Array.from(grid.querySelectorAll('span')).map((span) => String(span.textContent || '').trim());
    return labels.includes('الملعب') && labels.includes('الحكم');
  });
  if (!infoGrid) return;

  infoGrid.classList.remove('lg:grid-cols-4');
  infoGrid.classList.add('lg:grid-cols-5');

  const cards = Array.from(infoGrid.children).filter((child) => child instanceof HTMLElement) as HTMLElement[];
  const venue = cards.find((card) => cardLabel(card) === 'الملعب') || null;
  const city = cards.find((card) => cardLabel(card) === 'المدينة') || null;
  const referee = cards.find((card) => cardLabel(card) === 'الحكم') || null;
  const group = cards.find((card) => cardLabel(card) === 'المجموعة') || null;
  let dateCard = infoGrid.querySelector('[data-match-date-card="true"]') as HTMLElement | null;
  if (!dateCard) dateCard = makeDateCard(dateText);
  const valueNode = dateCard.querySelector('p');
  if (valueNode) valueNode.textContent = dateText || '—';

  const ordered = [venue, dateCard, referee, city, group].filter(Boolean) as HTMLElement[];
  ordered.forEach((card) => infoGrid.appendChild(card));

  const scheduledPill = Array.from(header.querySelectorAll('p')).find((node) => String(node.textContent || '').includes('موعد المباراة:')) as HTMLElement | undefined;
  if (scheduledPill) scheduledPill.style.display = 'none';
}

export default function ProfessionalMatchPageWithDateCard({ data }: { data: MatchPageData }) {
  useEffect(() => {
    arrangeInfoCards(fullDate(data.matchDate));
    const id = window.setTimeout(() => arrangeInfoCards(fullDate(data.matchDate)), 250);
    return () => window.clearTimeout(id);
  }, [data.matchDate, data.venue, data.city, data.referee, data.groupLabel, data.stageLabel, data.status.kind]);

  return <ProfessionalMatchPageClient data={data} />;
}
