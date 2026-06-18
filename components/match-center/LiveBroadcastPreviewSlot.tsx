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
  }, []);

  return <div ref={ref}>{children}</div>;
}
