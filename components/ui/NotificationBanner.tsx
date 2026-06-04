'use client';

import React from 'react';
import { useStore } from '@/lib/store';

export function NotificationBanner() {
  const { notifications } = useStore();

  if (!notifications.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map((msg, idx) => (
        <div key={idx} className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between border border-blue-400">
          <span>{msg}</span>
        </div>
      ))}
    </div>
  );
}
