/**
 * Notifications API
 * 
 * Purpose : Calls the notifications feed and registers the device token.
 * Spec    : Section 13
 * Look here when : Push registration fails.
 */

import { mock, request, useMockData } from './client';
import type { AppNotification } from '../types/database';

const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', user_id: 'demo-user', type: 'low_stock', title: 'Highland Milk Powder is low', body: 'Only 12 units left, below your threshold of 25.', related_order_id: null, related_stock_item_id: 'si7', read_at: null, created_at: '2026-09-01T06:30:00Z' },
  { id: 'n2', user_id: 'demo-user', type: 'supplier_delivered', title: 'Smart Products marked DEL-0010 delivered', body: 'Confirm receipt so your stock is topped up.', related_order_id: 'o4', related_stock_item_id: null, read_at: null, created_at: '2026-08-31T06:25:00Z' },
  { id: 'n3', user_id: 'demo-user', type: 'order_rejected', title: 'Apex Distributors rejected DEL-0021', body: 'Out of stock until the middle of next month. The product is back in Low stock.', related_order_id: 'o6', related_stock_item_id: null, read_at: '2026-08-20T10:00:00Z', created_at: '2026-08-19T16:00:00Z' },
  { id: 'n4', user_id: 'demo-user', type: 'stage_change', title: 'DEL-0030 is now Processing', body: 'Prime Distributors is preparing your order.', related_order_id: 'o3', related_stock_item_id: null, read_at: '2026-08-27T08:00:00Z', created_at: '2026-08-26T12:00:00Z' },
  { id: 'n5', user_id: 'demo-user', type: 'seasonal', title: 'Christmas is 16 weeks away', body: 'Biscuits, Dairy and Sugar usually spike. Review your stock.', related_order_id: null, related_stock_item_id: null, read_at: '2026-08-26T09:00:00Z', created_at: '2026-08-25T05:00:00Z' },
  { id: 'n6', user_id: 'demo-user', type: 'stale_stock', title: 'No sales report for 9 days', body: 'Your stock figures may be out of date.', related_order_id: null, related_stock_item_id: null, read_at: '2026-08-25T07:00:00Z', created_at: '2026-08-24T05:00:00Z' },
];

export async function listNotifications(): Promise<AppNotification[]> {
  if (useMockData) return mock(NOTIFICATIONS);
  return request('/notifications');
}

export async function markRead(id: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/notifications/' + id + '/read', { method: 'POST' });
}

/**
 * Spec 5.12 — the platform is stored because Firebase needs to know it. Push itself is a
 * later phase; this endpoint exists so the token is captured as soon as there is one.
 */
export async function registerDevice(token: string, platform: 'ios' | 'android'): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/notifications/device', {
    method: 'POST',
    body: JSON.stringify({ fcm_token: token, platform }),
  });
}
