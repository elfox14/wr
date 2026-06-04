'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Toaster, toast } from 'react-hot-toast';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?unread=true');
        if (!res.ok) return;
        const unread = await res.json();

        if (unread.length > 0) {
          const idsToMark: string[] = [];
          
          unread.forEach((n: any) => {
            idsToMark.push(n.id);
            
            // Show toast based on type
            if (n.type === 'SUCCESS') toast.success(n.message, { icon: '💰' });
            else if (n.type === 'ERROR' || n.type === 'WARNING') toast.error(n.message, { icon: '📉' });
            else toast(n.message, { icon: '🔔' });
          });

          // Mark as read so they don't pop up again
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: idsToMark })
          });
        }
      } catch (e) {
        console.error('Polling error', e);
      }
    };

    // Poll every 10 seconds
    const interval = setInterval(fetchNotifications, 10000);
    // Initial fetch
    fetchNotifications();

    return () => clearInterval(interval);
  }, [session]);

  return (
    <>
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: '#1A1A1A',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
        }
      }} />
      {children}
    </>
  );
}
