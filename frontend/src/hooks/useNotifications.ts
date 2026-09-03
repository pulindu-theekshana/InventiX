/**
 * Notification hook
 * 
 * Purpose : Registers the device token and handles a tapped notification.
 * Spec    : Section 13
 * Look here when : Tapping a push does not open the right screen.
 */

import { useAsync } from './useAsync';
import { listNotifications } from '../api/notifications';
import type { AppNotification } from '../types/database';

export function useNotifications() {
  const state = useAsync(() => listNotifications(), []);
  const unread = (state.data ?? []).filter((n) => n.read_at === null).length;
  return { ...state, unread };
}

/**
 * Spec 13 — tapping a notification opens the screen it relates to. Kept here rather than in
 * the screen so push handling and the in-app list route identically.
 */
export function routeFor(n: AppNotification): string {
  if (n.related_order_id) return '/delivery/' + n.related_order_id;
  if (n.related_stock_item_id) return '/stocks/' + n.related_stock_item_id;
  if (n.type === 'seasonal') return '/stocks';
  if (n.type === 'stale_stock') return '/stocks/upload';
  return '/notifications';
}
