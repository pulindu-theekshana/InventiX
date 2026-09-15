/**
 * Customer delivery API
 * 
 * Purpose : Calls the customer delivery feed.
 * Spec    : Section 8
 * Look here when : Delivery screens show no data.
 */

import { mock, request, useMockData } from './client';
import type { OrderDetailView, OrderSummary } from '../types/api';
import type { OrderStatus } from '../types/orderStatus';

const ORDERS: OrderSummary[] = [
  { id: 'o1', reference: 'DEL-0001', status: 'requested', channel: 'in_app', counterparty_name: 'Lanka Traders (pvt) Ltd', counterparty_city: 'Colombo 11', item_count: 3, total_quantity: 90, total_value: 42500, requested_at: '2026-08-30T08:00:00Z', requested_delivery_date: '2026-09-05', supplier_marked_delivered_at: null, rejection_reason: null, product_summary: null },
  { id: 'o2', reference: 'DEL-0009', status: 'confirmed', channel: 'in_app', counterparty_name: 'Global Suppliers and CO', counterparty_city: 'Colombo 05', item_count: 2, total_quantity: 60, total_value: 46500, requested_at: '2026-08-27T10:30:00Z', requested_delivery_date: '2026-09-03', supplier_marked_delivered_at: null, rejection_reason: null, product_summary: null },
  { id: 'o3', reference: 'DEL-0030', status: 'processing', channel: 'in_app', counterparty_name: 'Prime Distributors', counterparty_city: 'Pettah, Colombo', item_count: 1, total_quantity: 40, total_value: 13800, requested_at: '2026-08-25T09:15:00Z', requested_delivery_date: '2026-09-01', supplier_marked_delivered_at: null, rejection_reason: null, product_summary: null },
  { id: 'o4', reference: 'DEL-0010', status: 'on_the_way', channel: 'whatsapp', counterparty_name: 'Smart Products Pvt Ltd', counterparty_city: 'Negombo', item_count: 2, total_quantity: 35, total_value: 21400, requested_at: '2026-08-22T14:00:00Z', requested_delivery_date: '2026-08-31', supplier_marked_delivered_at: '2026-08-31T06:20:00Z', rejection_reason: null, product_summary: null },
  { id: 'o5', reference: 'DEL-0002', status: 'purchased', channel: 'in_app', counterparty_name: 'Tech Solutions Ltd', counterparty_city: 'Colombo 09', item_count: 4, total_quantity: 120, total_value: 84000, requested_at: '2026-08-10T11:00:00Z', requested_delivery_date: '2026-08-18', supplier_marked_delivered_at: '2026-08-17T09:00:00Z', rejection_reason: null, product_summary: null },
  { id: 'o6', reference: 'DEL-0021', status: 'rejected', channel: 'in_app', counterparty_name: 'Apex Distributors', counterparty_city: 'Galle', item_count: 1, total_quantity: 20, total_value: 15600, requested_at: '2026-08-19T08:45:00Z', requested_delivery_date: '2026-08-26', supplier_marked_delivered_at: null, rejection_reason: 'Out of stock until the middle of next month.', product_summary: null },
  { id: 'o7', reference: 'DEL-0018', status: 'cancelled', channel: 'email', counterparty_name: 'Prime Distributors', counterparty_city: 'Pettah, Colombo', item_count: 2, total_quantity: 30, total_value: 9800, requested_at: '2026-08-12T12:00:00Z', requested_delivery_date: '2026-08-20', supplier_marked_delivered_at: null, rejection_reason: null, product_summary: null },
];

export async function listOrders(): Promise<OrderSummary[]> {
  if (useMockData) return mock(ORDERS);
  return request('/customer/delivery');
}

export async function getOrder(id: string): Promise<OrderDetailView | null> {
  if (useMockData) {
    const base = ORDERS.find((o) => o.id === id);
    if (!base) return mock(null);
    return mock({
      ...base,
      message_body:
        'Hi ' + base.counterparty_name + ',\n\nThis is a reorder from Wasantha Kade. The following items have fallen below our minimum threshold and require restocking:\n\n- Highland Milk Powder 400 g, current stock 12, requested 60\n- White Sugar 1 kg, current stock 85, requested 30\n\nPreferred delivery: within 6 business days.\n\nPlease confirm receipt of this order and let us know if any items are currently out of stock.\n\nThank you!',
      items: [
        { catalog_product_id: 'p5', name: 'Highland Milk Powder', pack_size: '400 g', quantity_requested: 60, unit_price_at_order: 1180 },
        { catalog_product_id: 'p3', name: 'White Sugar', pack_size: '1 kg', quantity_requested: 30, unit_price_at_order: 258 },
      ],
      stage_history: buildHistory(base.status, base.requested_at),
      counterparty_phone: '077 123 4567',
      counterparty_address: 'No 44, Main Street, ' + (base.counterparty_city ?? 'Colombo'),
      rating: base.status === 'purchased' ? { quality_score: 4, comment: 'Arrived on time, packaging was good.' } : null,
    });
  }
  return request('/customer/delivery/' + id);
}

function buildHistory(status: OrderStatus, requestedAt: string) {
  const order: OrderStatus[] = ['requested', 'confirmed', 'processing', 'put_to_delivery', 'on_the_way', 'purchased'];
  const reached = order.slice(0, order.indexOf(status) + 1);
  const start = new Date(requestedAt).getTime();
  return reached.map((s, i) => ({ status: s, at: new Date(start + i * 86_400_000).toISOString() }));
}

/** Spec 8.3 — the only action that tops up stock, and the only one that sets purchased. */
export async function confirmReceipt(id: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/delivery/' + id + '/confirm-receipt', { method: 'POST' });
}

export async function cancelOrder(id: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/delivery/' + id + '/cancel', { method: 'POST' });
}

/**
 * Spec 8.3 — only for orders sent by WhatsApp or email, where the supplier is updating the
 * customer outside the app. The backend still validates the transition.
 */
export async function advanceStage(id: string, status: OrderStatus): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/delivery/' + id + '/advance', {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
