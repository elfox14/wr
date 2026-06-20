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

function matchClockText(data: MatchPageData) {
  if (data.status.isScheduled) return fullDate(data.matchDate);
  if (data.status.isFinished) return 'نهاية المباراة';
  return data.status.label || data.status.shortLabel || 'زمن المباراة';
}

function matchClockCardLabel(data: MatchPageData) {
  return data.status.isScheduled ? 'موعد المباراة' : 'زمن المباراة';
}

function cardLabel(card: Element) {
  return String(card.querySelector('span')?.textContent || '').trim();
}

function makeDateCard(value: string, labelText = 'موعد المباراة') {
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
  label.textContent = labelText;

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

function hideScoreClock(header: Element) {
  const clockPill = Array.from(header.querySelectorAll('p')).find((node) => {
    const className = String(node.getAttribute('class') || '');
    return className.includes('mx-auto') && className.includes('rounded-full') && className.includes('border');
  }) as HTMLElement | undefined;
  if (clockPill) clockPill.style.display = 'none';
}

function arrangeInfoCards(clockText: string, labelText: string) {
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
  if (!dateCard) dateCard = makeDateCard(clockText, labelText);

  const labelNode = dateCard.querySelector('span:nth-of-type(2)') || dateCard.querySelector('div span:last-child');
  if (labelNode) labelNode.textContent = labelText;
  const valueNode = dateCard.querySelector('p');
  if (valueNode) valueNode.textContent = clockText || '—';

  const ordered = [venue, dateCard, referee, city, group].filter(Boolean) as HTMLElement[];
  ordered.forEach((card) => infoGrid.appendChild(card));
  hideScoreClock(header);
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

function resetThirdsList(list: HTMLElement | null) {
  if (!list) return;
  list.style.removeProperty('display');
  list.style.removeProperty('grid-template-columns');
  list.style.removeProperty('gap');
  Array.from(list.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    child.style.removeProperty('margin-top');
    child.style.removeProperty('margin-bottom');
  });
}

function makeTablesResponsive() {
  const standingsSection = document.getElementById('standings') as HTMLElement | null;
  if (!standingsSection) return;

  const mainGrid = Array.from(standingsSection.children).find((child) => {
    if (!(child instanceof HTMLElement)) return false;
    const text = String(child.textContent || '');
    return child.className.includes('grid') && text.includes('ترتيب المجموعة') && text.includes('أفضل الثوالث');
  }) as HTMLElement | null;
  if (!mainGrid) return;

  const panels = Array.from(mainGrid.children).filter((child) => child instanceof HTMLElement) as HTMLElement[];
  const thirdsPanel = panels.find((panel) => String(panel.textContent || '').includes('أفضل الثوالث')) || panels[1] || null;
  const thirdsList = thirdsPanel ? Array.from(thirdsPanel.children).find((child) => child instanceof HTMLElement && child.className.includes('space-y-2')) as HTMLElement | null : null;
  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

  standingsSection.style.setProperty('overflow-x', 'visible', 'important');
  standingsSection.style.setProperty('padding-bottom', '0', 'important');
  mainGrid.classList.remove('xl:grid-cols-2');
  mainGrid.style.setProperty('min-width', '0', 'important');
  mainGrid.style.setProperty('align-items', 'start', 'important');

  if (isDesktop) {
    mainGrid.style.setProperty('display', 'grid', 'important');
    mainGrid.style.setProperty('grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)', 'important');
    mainGrid.style.setProperty('gap', '1rem', 'important');
    if (thirdsList) {
      thirdsList.style.setProperty('display', 'grid', 'important');
      thirdsList.style.setProperty('grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)', 'important');
      thirdsList.style.setProperty('gap', '0.5rem', 'important');
      Array.from(thirdsList.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        child.style.setProperty('margin-top', '0', 'important');
        child.style.setProperty('margin-bottom', '0', 'important');
      });
    }
  } else {
    mainGrid.style.setProperty('display', 'grid', 'important');
    mainGrid.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
    mainGrid.style.setProperty('gap', '1rem', 'important');
    resetThirdsList(thirdsList);
  }

  panels.forEach((panel) => panel.style.setProperty('min-width', '0', 'important'));
}

function enhanceMatchPage(data: MatchPageData) {
  arrangeInfoCards(matchClockText(data), matchClockCardLabel(data));
  compactEmptyGap();
  addPlayerStatsNotice(data);
  makeTablesResponsive();
}

export default function ProfessionalMatchPageWithDateCard({ data }: { data: MatchPageData }) {
  useEffect(() => {
    enhanceMatchPage(data);
    const timers = [250, 900].map((ms) => window.setTimeout(() => enhanceMatchPage(data), ms));
    const onResize = () => enhanceMatchPage(data);
    window.addEventListener('resize', onResize);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', onResize);
    };
  }, [data]);

  return <ProfessionalMatchPageClient data={data} />;
}
