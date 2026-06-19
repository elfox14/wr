'use client';

import { useEffect } from 'react';

export function HardNavigationGuard() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reloadCurrentPage = () => {
      window.setTimeout(() => {
        window.location.reload();
      }, 0);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reloadCurrentPage();
    };

    window.history.scrollRestoration = 'manual';
    window.addEventListener('popstate', reloadCurrentPage);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('popstate', reloadCurrentPage);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  return null;
}
