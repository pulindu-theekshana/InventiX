/**
 * Notification hook
 * 
 * Purpose : Registers the device token and handles a tapped notification.
 * Spec    : Section 13
 * Look here when : Tapping a push does not open the right screen.
 */

import { useAsync } from './useAsync';
import { useRealtime } from './useRealtime';
import { listNotifications } from '../api/notifications';
import type { AppNotification, Role } from '../types/database';

export function useNotifications() {
  const state = useAsync(() => listNotifications(), []);

  /**
   * The header renders this hook once and then sits there for the whole session, so without
   * a subscription the unread dot only reflects whatever was true when the screen mounted --
   * a notification arriving while the owner is on Stocks never shows until they open the bell
   * for some other reason, which is the one moment it is no longer useful.
   *
   * Row level security applies to realtime too, so this only ever wakes for this user's rows.
   */
  useRealtime('notifications', null, state.refresh);

  const unread = (state.data ?? []).filter((n) => n.read_at === null).length;
  return { ...state, unread };
}

/**
 * Spec 13 — tapping a notification opens the screen it relates to. Kept here rather than in
 * the screen so push handling and the in-app list route identically.
 *
 * The group is part of the path on purpose. Both roles define `/delivery` and `/orders`, so
 * without `(customer)` or `(supplier)` expo-router cannot tell which one is meant. The role
 * also decides what "this order" means: the shop tracks it under Delivery, the supplier acts
 * on it under Orders.
 */
export function routeFor(n: AppNotification, role: Role | null): string {
  if (role === 'supplier') {
    if (n.related_order_id) return '/(supplier)/orders/' + n.related_order_id;
    return '/notifications';
  }

  if (n.related_order_id) return '/(customer)/delivery/' + n.related_order_id;
  if (n.related_stock_item_id) return '/(customer)/stocks/' + n.related_stock_item_id;
  if (n.type === 'seasonal') return '/(customer)/stocks';
  if (n.type === 'stale_stock') return '/(customer)/stocks/upload';
  return '/notifications';
}
