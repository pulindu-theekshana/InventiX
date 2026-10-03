/**
 * Till API
 *
 * Purpose : The POS endpoints: send a finished bill, read the day's bills, find one by receipt number, and the day-close summary.
 * Spec    : Section 6.6
 * Look here when : A sale never reaches the backend, or the day summary is empty.
 */

import { request } from './client';
import type {
  CashierAccount,
  DaySummary,
  PosSettings,
  ReturnPayload,
  Sale,
  SalePayload,
  TillActivity,
} from '../types/api';

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

export async function getSettings(): Promise<PosSettings> {
  return request('/customer/pos/settings');
}

export async function saveSettings(settings: PosSettings): Promise<PosSettings> {
  return request('/customer/pos/settings', { method: 'PUT', body: JSON.stringify(settings) });
}

/**
 * Who sold what, between two dates. The owner's screen, not the till's: the backend answers a
 * cashier 403, so this is never called from /pos.
 */
export async function tillActivity(from: string, to: string): Promise<TillActivity> {
  return request(`/customer/pos/activity?from=${from}&to=${to}`);
}

/**
 * The shop's staff logins. Owner only: the backend answers a cashier 403, which is the point of
 * them being accounts rather than names in a list.
 */
export async function listCashiers(): Promise<CashierAccount[]> {
  return request('/customer/pos/cashiers');
}

/** The login address comes back once, for the owner to pass on. It is not shown again. */
export async function createCashier(name: string, password: string): Promise<CashierAccount> {
  return request('/customer/pos/cashiers', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  });
}

/** Switched off rather than deleted, so the bills they rang keep their name. */
export async function removeCashier(id: string): Promise<void> {
  await request(`/customer/pos/cashiers/${id}`, { method: 'DELETE' });
}

/** Where this shop's numbering has reached for a till, so a device with cleared storage fits in. */
export async function nextReceiptNo(deviceId: string): Promise<string> {
  const body = await request<{ receipt_no: string }>(
    `/customer/pos/next-receipt?device=${encodeURIComponent(deviceId)}`,
  );
  return body.receipt_no;
}
