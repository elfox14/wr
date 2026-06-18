'use client';

import { type ReactNode, useEffect, useRef } from 'react';

type Props = {
  children: ReactNode;
};

export default function LiveBroadcastPreviewSlot({ children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const labels = Array.from(document.querySelectorAll('div'));
    const statsLabel = labels.find((element) => element.textContent?.trim() === 'Stats Board');
    const statsSection = statsLabel?.closest('section');

    if (statsSection?.parentElement && statsSection.previousElementSibling !== root) {
      statsSection.parentElement.insertBefore(root, statsSection);
    }

    const oldEventsTitle = Array.from(document.querySelectorAll('h2')).find((element) => element.textContent?.trim() === 'أحداث المباراة' && !root.contains(element));
    const oldEventsSection = oldEventsTitle?.closest('section') as HTMLElement | null;
    if (oldEventsSection) {
      oldEventsSection.style.display = 'none';
      const parent = oldEventsSection.parentElement as HTMLElement | null;
      if (parent) parent.style.gridTemplateColumns = '1fr';
    }
  }, []);

  return <div ref={ref}>{children}</div>;
}
