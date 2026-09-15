/**
 * Supplier overview API
 *
 * Purpose : The summary above a supplier's listings: who they are, how they are rated, and which shops buy from them.
 * Spec    : Section 10.1 and 12
 * Look here when : The supplier dashboard is empty or shows stale figures.
 */

import { mock, request, useMockData } from './client';

export interface TopCustomer {
  name: string;
  orders: number;
  total_value: number;
}

export interface SupplierOverview {
  business_name: string;
  city: string | null;
  /** From the precomputed ranking row, so it matches exactly what customers see. Spec 12. */
  average_rating: number | null;
  rating_count: number;
  score: number | null;
  is_new_supplier: boolean;
  active_listings: number;
  pending_orders: number;
  active_orders: number;
  completed_orders: number;
  top_customers: TopCustomer[];
}

export async function getOverview(): Promise<SupplierOverview> {
  if (useMockData) {
    return mock({
      business_name: 'Lanka Traders (pvt) Ltd',
      city: 'Colombo 11',
      average_rating: 4.5,
      rating_count: 2,
      score: 81,
      is_new_supplier: true,
      active_listings: 4,
      pending_orders: 1,
      active_orders: 2,
      completed_orders: 3,
      top_customers: [{ name: 'Wasantha Kade', orders: 3, total_value: 120800 }],
    });
  }
  return request('/supplier/overview');
}
