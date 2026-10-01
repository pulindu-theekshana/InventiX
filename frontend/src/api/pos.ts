/**
 * Till API
 *
 * Purpose : The POS endpoints: send a finished bill, read the day's bills, find one by receipt number, and the day-close summary.
 * Spec    : Section 6.6
 * Look here when : A sale never reaches the backend, or the day summary is empty.
 */

import { request } from './client';
import type { DaySummary, ReturnPayload, Sale, SalePayload } from '../types/api';

/**
 * Safe to call twice with the same payload: the backend keys on client_sale_id and returns the
 * bill it already stored. That is what lets the queue retry without billing a customer twice.
 */
export async function recordSale(sale: SalePayload): Promise<Sale> {
  return request('/customer/pos/sales', { method: 'POST', body: JSON.stringify(sale) });
}

/**
 * A return needs the original bill, which only the backend has, so unlike a sale this one
 * cannot be made offline. The till says so rather than queueing something it cannot price.
 */
export async function recordReturn(ret: ReturnPayload): Promise<Sale> {
  return request('/customer/pos/returns', { method: 'POST', body: JSON.stringify(ret) });
}

export async function listSales(day?: string): Promise<Sale[]> {
  return request(`/customer/pos/sales${day ? `?day=${day}` : ''}`);
}

export async function findSale(receiptNo: string): Promise<Sale> {
  return request(`/customer/pos/sales/${encodeURIComponent(receiptNo)}`);
}

export async function daySummary(day?: string): Promise<DaySummary> {
  return request(`/customer/pos/summary${day ? `?day=${day}` : ''}`);
}
