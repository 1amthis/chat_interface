export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface NotificationPayload {
  id: string;
  message: string;
  level: NotificationLevel;
}

const NOTIFICATION_EVENT = 'opus:notification';

export function notify(message: string, level: NotificationLevel = 'info'): void {
  if (typeof window === 'undefined') return;

  const payload: NotificationPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    message,
    level,
  };

  window.dispatchEvent(new CustomEvent<NotificationPayload>(NOTIFICATION_EVENT, { detail: payload }));
}

export function subscribeToNotifications(
  onNotification: (payload: NotificationPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<NotificationPayload>;
    if (customEvent.detail) {
      onNotification(customEvent.detail);
    }
  };

  window.addEventListener(NOTIFICATION_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATION_EVENT, handler);
}
