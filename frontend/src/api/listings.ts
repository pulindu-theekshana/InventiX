/**
 * Listings API
 * 
 * Purpose : Calls the supplier listings feed.
 * Spec    : Section 10.1
 * Look here when : Listings show no data.
 */

import { mock, request, useMockData } from './client';
import { CATALOG } from './catalog';
import type { ListingView } from '../types/api';

const LISTINGS: ListingView[] = [
  { id: 'ml1', product: CATALOG[0], quantity_available: 240, unit_price: 1250, min_order_quantity: 10, lead_time_days: 2, is_active: true, is_low: false },
  { id: 'ml2', product: CATALOG[2], quantity_available: 180, unit_price: 258, min_order_quantity: 20, lead_time_days: 2, is_active: true, is_low: false },
  { id: 'ml3', product: CATALOG[4], quantity_available: 22, unit_price: 1180, min_order_quantity: 12, lead_time_days: 3, is_active: true, is_low: true },
  { id: 'ml4', product: CATALOG[6], quantity_available: 90, unit_price: 345, min_order_quantity: 10, lead_time_days: 2, is_active: true, is_low: false },
  { id: 'ml5', product: CATALOG[8], quantity_available: 15, unit_price: 775, min_order_quantity: 10, lead_time_days: 3, is_active: true, is_low: true },
  { id: 'ml6', product: CATALOG[10], quantity_available: 60, unit_price: 980, min_order_quantity: 6, lead_time_days: 4, is_active: false, is_low: false },
];

export async function listListings(): Promise<ListingView[]> {
  if (useMockData) return mock(LISTINGS);
  return request('/supplier/listings');
}

export async function getListing(id: string): Promise<ListingView | null> {
  if (useMockData) return mock(LISTINGS.find((l) => l.id === id) ?? null);
  return request('/supplier/listings/' + id);
}

export interface ListingInput {
  catalog_product_id: string;
  quantity_available: number;
  unit_price: number;
  min_order_quantity: number;
  lead_time_days: number;
}

export async function createListing(input: ListingInput): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/listings', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateListing(id: string, input: Partial<ListingInput>): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/listings/' + id, { method: 'PATCH', body: JSON.stringify(input) });
}

/**
 * Spec 10.1 — deactivate rather than delete, so the order history that references this
 * listing keeps working.
 */
export async function setActive(id: string, isActive: boolean): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/supplier/listings/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}
