/**
 * Supplier orders API
 * 
 * Purpose : Calls the supplier orders feed, and the supplier delivery queue. Both live here because spec 10.5 is explicit that Orders and Delivery read the same orders table with different status filters, so splitting them would mean two files fetching the same rows.
 * Spec    : Section 10.2 and 10.3
 * Look here when : Supplier orders show no data.
 */

import { mock, request, useMockData } from './client';
import type { OrderDetailView, OrderSummary } from '../types/api';
import type { OrderStatus } from '../types/orderStatus';

const ORDERS: OrderSummary[] = [
  { id: 'so1', reference: 'DEL-0001', status: 'requested', channel: 'in_app', counterparty_name: 'Saman Stores', counterparty_city: 'Colombo', item_count: 5, total_quantity: 150, total_value: 12450, requested_at: '2026-08-30T08:00:00Z', requested_delivery_date: '2026-09-05', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so2', reference: 'DEL-0002', status: 'requested', channel: 'in_app', counterparty_name: 'Nimal Stores', counterparty_city: 'Kandy', item_count: 4, total_quantity: 80, total_value: 1450, requested_at: '2026-08-29T09:30:00Z', requested_delivery_date: '2026-09-04', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so3', reference: 'DEL-0003', status: 'confirmed', channel: 'in_app', counterparty_name: 'Nuwan Super Mart', counterparty_city: 'Colombo', item_count: 6, total_quantity: 210, total_value: 8500, requested_at: '2026-08-28T11:00:00Z', requested_delivery_date: '2026-09-02', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so4', reference: 'DEL-0004', status: 'processing', channel: 'in_app', counterparty_name: 'City Mart', counterparty_city: 'Jaffna', item_count: 10, total_quantity: 340, total_value: 12150, requested_at: '2026-08-26T13:20:00Z', requested_delivery_date: '2026-09-01', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so5', reference: 'DEL-0011', status: 'put_to_delivery', channel: 'in_app', counterparty_name: 'Samantha Stores', counterparty_city: 'Galle', item_count: 7, total_quantity: 190, total_value: 1350, requested_at: '2026-08-24T08:10:00Z', requested_delivery_date: '2026-08-31', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so6', reference: 'DEL-0012', status: 'on_the_way', channel: 'in_app', counterparty_name: 'Nuwan Stores', counterparty_city: 'Colombo', item_count: 5, total_quantity: 120, total_value: 3450, requested_at: '2026-08-23T07:45:00Z', requested_delivery_date: '2026-08-30', supplier_marked_delivered_at: null, rejection_reason: null },
  { id: 'so7', reference: 'DEL-0013', status: 'purchased', channel: 'in_app', counterparty_name: 'Ruwan Super Mart', counterparty_city: 'Galle', item_count: 6, total_quantity: 260, total_value: 11440, requested_at: '2026-08-08T10:00:00Z', requested_delivery_date: '2026-08-15', supplier_marked_delivered_at: '2026-08-14T09:00:00Z', rejection_reason: null },
  { id: 'so8', reference: 'DEL-0016', status: 'rejected', channel: 'in_app', counterparty_name: 'Kamal Traders', counterparty_city: 'Matara', item_count: 2, total_quantity: 40, total_value: 5200, requested_at: '2026-08-05T15:30:00Z', requested_delivery_date: '2026-08-12', supplier_marked_delivered_at: null, rejection_reason: 'Requested quantity not available.' },
];

export async function listOrders(): Promise<OrderSummary[]> {
  if (useMockData) return mock(ORDERS);
  return request('/supplier/orders');
}

export async function getOrder(id: string): Promise<OrderDetailView | null> {
  if (useMockData) {
    const base = ORDERS.find((o) => o.id === id);
    if (!base) return mock(null);
    return mock({
      ...base,
      message_body:
        'Hi,\n\nThis is a reorder from ' + base.counterparty_name + '. The following items have fallen below our minimum threshold and require restocking:\n\n- Araliya Keeri Samba Rice 5 kg, requested 40\n- White Sugar 1 kg, requested 60\n\nPlease confirm receipt of this order.\n\nThank you!',
      items: [
        { catalog_product_id: 'p1', name: 'Araliya Keeri Samba Rice', pack_size: '5 kg', quantity_requested: 40, unit_price_at_order: 1250 },
        { catalog_product_id: 'p3', name: 'White Sugar', pack_size: '1 kg', quantity_requested: 60, unit_price_at_order: 258 },
      ],
      stage_history: [{ status: 'requested' as OrderStatus, at: base.requested_at }],
      counterparty_phone: '077 456 7890',
      counterparty_address: 'No 12, Market Road, ' + (base.counterparty_city ?? 'Colombo'),
      rating: base.status === 'purchased' ? { quality_score: 5, comment: null } : null,
    });
  }
  return request('/supplier/orders/' + id);
}

/**
 * Spec 10.2 — confirming reduces quantity_available on every listing in the order. The
 * backend blocks this when availability has fallen since the order was placed, leaving only
 * Reject available, so a supplier can never confirm stock they no longer hold.
 */
export async function confirmOrder(id: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/orders/' + id + '/confirm', { method: 'POST' });
}

/** Spec 10.2 — a reason is required, is stored on the order, and is shown to the customer. */
export async function rejectOrder(id: string, reason: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/orders/' + id + '/reject', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Spec 10.3 — stage advancement from the Delivery queue card. */
export async function advanceStage(id: string, next: OrderStatus): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/delivery/' + id + '/advance', {
    method: 'POST',
    body: JSON.stringify({ status: next }),
  });
}

/**
 * Spec 11.3 — records supplier_marked_delivered_at and notifies the customer. It does NOT
 * set purchased. Only the customer can complete an order, because stock must not increase
 * on an unverified claim.
 */
export async function markDelivered(id: string): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/delivery/' + id + '/delivered', { method: 'POST' });
}
