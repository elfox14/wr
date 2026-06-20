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

function makePlayerStatsNotice(isFinished: boolean) {
  const notice = document.createElement('div');
  notice.setAttribute('data-player-stats-notice', 'true');
  notice.className = 'mt-4 rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-center';

  const title = document.createElement('p');
  title.className = 'font-black text-white';
  title.textContent = isFinished ? 'جاري جلب إحصائيات اللاعبين' : 'ستتوفر إحصائيات اللاعبين بعد المباراة';

  const body = document.createElement('p');
  body.className = 'mt-2 text-sm font-bold leading-7 text-slate-400';
  body.textContent = isFinished
    ? 'لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة.'
    : 'أثناء البث المباشر لا نعرض أرقامًا غير مكتملة. ستظهر إحصائيات اللاعبين بعد نهاية المباراة ووصول البيانات الموثقة.';

  notice.append(title, body);
  return notice;
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

function compactEmptyGap() {
  const header = document.querySelector('header');
  const spacer = header?.nextElementSibling as HTMLElement | null;
  if (!spacer) return;
  const className = String(spacer.getAttribute('class') || '');
  if (!className.includes('h-[54px]')) return;
  spacer.style.height = '0px';
  spacer.style.minHeight = '0px';
  spacer.style.margin = '0px';
  spacer.style.padding = '0px';
  spacer.style.overflow = 'hidden';
}

function addPlayerStatsNotice(data: MatchPageData) {
  const lineupsSection = document.getElementById('lineups');
  if (!lineupsSection) return;

  const hasPlayerStatsTable = String(lineupsSection.textContent || '').includes('إحصائيات لاعبي التشكيل والبدلاء');
  let notice = lineupsSection.querySelector('[data-player-stats-notice="true"]') as HTMLElement | null;

  if (hasPlayerStatsTable) {
    notice?.remove();
    return;
  }

  if (!notice) {
    notice = makePlayerStatsNotice(data.status.isFinished);
    lineupsSection.appendChild(notice);
  } else {
    const title = notice.querySelector('p');
    const body = notice.querySelectorAll('p')[1];
    if (title) title.textContent = data.status.isFinished ? 'جاري جلب إحصائيات اللاعبين' : 'ستتوفر إحصائيات اللاعبين بعد المباراة';
    if (body) body.textContent = data.status.isFinished
      ? 'لم تصل إحصائيات اللاعبين بعد. ستظهر هنا تلقائيًا فور حفظ بيانات ما بعد المباراة.'
      : 'أثناء البث المباشر لا نعرض أرقامًا غير مكتملة. ستظهر إحصائيات اللاعبين بعد نهاية المباراة ووصول البيانات الموثقة.';
  }
}

function makeTablesSideBySide() {
  const standingsSection = document.getElementById('standings');
  if (!standingsSection) return;

  standingsSection.style.overflowX = 'auto';
  standingsSection.style.paddingBottom = '0.75rem';

  const titleGrids = Array.from(standingsSection.querySelectorAll('div.grid')) as HTMLElement[];
  const mainGrid = titleGrids.find((grid) => {
    const text = String(grid.textContent || '');
    return text.includes('ترتيب المجموعة') && text.includes('أفضل الثوالث');
  });
  if (!mainGrid) return;

  mainGrid.classList.remove('xl:grid-cols-2');
  mainGrid.classList.add('grid-cols-2');
  mainGrid.style.gridTemplateColumns = 'minmax(280px, 1fr) minmax(280px, 1fr)';
  mainGrid.style.minWidth = '620px';
  mainGrid.style.alignItems = 'start';

  Array.from(mainGrid.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.style.minWidth = '0';
  });
}

function enhanceMatchPage(data: MatchPageData) {
  arrangeInfoCards(fullDate(data.matchDate));
  compactEmptyGap();
  addPlayerStatsNotice(data);
  makeTablesSideBySide();
}

export default function ProfessionalMatchPageWithDateCard({ data }: { data: MatchPageData }) {
  useEffect(() => {
    enhanceMatchPage(data);
    const timers = [250, 900].map((ms) => window.setTimeout(() => enhanceMatchPage(data), ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [data]);

  return <ProfessionalMatchPageClient data={data} />;
}
