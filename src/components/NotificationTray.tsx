'use client';

import { useEffect, useRef, useState } from 'react';
import { NotificationPayload, subscribeToNotifications } from '@/lib/notifications';

const LEVEL_STYLES: Record<NotificationPayload['level'], string> = {
  info: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  success: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/60 dark:text-green-200',
  warning: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200',
};

export function NotificationTray() {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const timeoutMapRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((payload) => {
      setNotifications((prev) => [...prev, payload]);
      timeoutMapRef.current[payload.id] = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== payload.id));
        delete timeoutMapRef.current[payload.id];
      }, 4000);
    });

    return () => {
      unsubscribe();
      for (const timeout of Object.values(timeoutMapRef.current)) {
        clearTimeout(timeout);
      }
      timeoutMapRef.current = {};
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`rounded-lg border px-3 py-2 text-sm shadow-lg backdrop-blur ${LEVEL_STYLES[notification.level]}`}
          role="status"
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
}
