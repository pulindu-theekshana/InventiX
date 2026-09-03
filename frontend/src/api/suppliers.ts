/**
 * Suppliers API
 * 
 * Purpose : Calls the customer suppliers feed. Search by company or by product, and the supplier profile. Ranking order comes from the backend, never from the app.
 * Spec    : Section 9
 * Look here when : Supplier search shows nothing.
 */

import { mock, request, useMockData } from './client';
import { CATALOG } from './catalog';
import type { ListingView, SupplierProfileView, SupplierView } from '../types/api';

/**
 * Spec 12: `score` is computed by the backend and refreshed by the daily ranking job.
 * It covers only the two context-free components, quality rating at 40 percent and measured
 * delivery speed at 30 percent, renormalised to 100. Availability and price are per-order and
 * appear as raw listing figures instead. See docs/04-decision-log.md.
 */
const SUPPLIERS: SupplierView[] = [
  { id: 's1', business_name: 'Lanka Traders (pvt) Ltd', city: 'Colombo 11', is_active: true, score: 92, average_rating: 4.6, rating_count: 38, measured_delivery_days: 2.1, is_new_supplier: false },
  { id: 's2', business_name: 'Global Suppliers and CO', city: 'Colombo 05', is_active: true, score: 84, average_rating: 4.3, rating_count: 21, measured_delivery_days: 3.0, is_new_supplier: false },
  { id: 's3', business_name: 'Tech Solutions Ltd', city: 'Colombo 09', is_active: true, score: 76, average_rating: 4.0, rating_count: 12, measured_delivery_days: 3.8, is_new_supplier: false },
  { id: 's4', business_name: 'Smart Products Pvt Ltd', city: 'Negombo', is_active: true, score: 70, average_rating: null, rating_count: 1, measured_delivery_days: null, is_new_supplier: true },
  { id: 's5', business_name: 'Apex Distributors', city: 'Galle', is_active: true, score: 68, average_rating: 3.6, rating_count: 7, measured_delivery_days: 4.5, is_new_supplier: false },
  { id: 's6', business_name: 'Prime Distributors', city: 'Pettah, Colombo', is_active: false, score: 55, average_rating: 3.1, rating_count: 9, measured_delivery_days: 6.2, is_new_supplier: false },
];

const LISTINGS: Record<string, ListingView[]> = {
  s1: [
    { id: 'l1', product: CATALOG[0], quantity_available: 240, unit_price: 1250, min_order_quantity: 10, lead_time_days: 2, is_active: true, is_low: false },
    { id: 'l2', product: CATALOG[2], quantity_available: 180, unit_price: 258, min_order_quantity: 20, lead_time_days: 2, is_active: true, is_low: false },
    { id: 'l3', product: CATALOG[4], quantity_available: 30, unit_price: 1180, min_order_quantity: 12, lead_time_days: 3, is_active: true, is_low: true },
    { id: 'l4', product: CATALOG[6], quantity_available: 90, unit_price: 345, min_order_quantity: 10, lead_time_days: 2, is_active: true, is_low: false },
  ],
  s2: [
    { id: 'l5', product: CATALOG[8], quantity_available: 200, unit_price: 775, min_order_quantity: 10, lead_time_days: 3, is_active: true, is_low: false },
    { id: 'l6', product: CATALOG[9], quantity_available: 140, unit_price: 770, min_order_quantity: 6, lead_time_days: 3, is_active: true, is_low: false },
    { id: 'l7', product: CATALOG[5], quantity_available: 55, unit_price: 1195, min_order_quantity: 12, lead_time_days: 4, is_active: true, is_low: false },
  ],
  s3: [
    { id: 'l8', product: CATALOG[1], quantity_available: 60, unit_price: 3200, min_order_quantity: 5, lead_time_days: 4, is_active: true, is_low: false },
  ],
};

export async function listSuppliers(query = ''): Promise<SupplierView[]> {
  if (useMockData) {
    const q = query.trim().toLowerCase();
    return mock(q ? SUPPLIERS.filter((s) => s.business_name.toLowerCase().includes(q)) : SUPPLIERS);
  }
  return request('/customer/suppliers?q=' + encodeURIComponent(query));
}

/**
 * Spec 9.1 — results are the suppliers with an active listing for that product, in ranking
 * order, each carrying the listing figures the customer needs to compare.
 */
export async function searchByProduct(catalogProductId: string): Promise<SupplierView[]> {
  if (useMockData) {
    const results = Object.entries(LISTINGS)
      .map(([supplierId, listings]): SupplierView | null => {
        const listing = listings.find((l) => l.product.id === catalogProductId);
        if (!listing) return null;
        const supplier = SUPPLIERS.find((s) => s.id === supplierId)!;
        return {
          ...supplier,
          listing: {
            unit_price: listing.unit_price,
            quantity_available: listing.quantity_available,
            lead_time_days: listing.lead_time_days,
            min_order_quantity: listing.min_order_quantity,
          },
        };
      })
      .filter((s): s is SupplierView => s !== null);
    return mock(results);
  }
  return request('/customer/suppliers/by-product/' + catalogProductId);
}

/**
 * Spec 9.3 selection mode: suppliers who cannot meet the requested quantity are still
 * returned, marked rather than hidden, so the customer sees why they rank lower.
 */
export async function searchForOrder(
  catalogProductId: string,
  quantity: number,
): Promise<SupplierView[]> {
  const results = await searchByProduct(catalogProductId);
  return results.map((s) => ({
    ...s,
    can_meet_quantity: (s.listing?.quantity_available ?? 0) >= quantity,
  }));
}

export async function getSupplier(id: string): Promise<SupplierProfileView | null> {
  if (useMockData) {
    const base = SUPPLIERS.find((s) => s.id === id);
    if (!base) return mock(null);
    const slug = base.business_name.split(' ')[0].toLowerCase();
    return mock({
      ...base,
      contact_person: 'Nimal Perera',
      phone: '077 123 4567',
      whatsapp_number: '077 123 4567',
      email: 'info@' + slug + '.lk',
      address: 'No 44, Main Street, ' + (base.city ?? 'Colombo'),
      delivery_areas: ['Colombo', 'Gampaha', 'Kalutara'],
      listings: LISTINGS[id] ?? [],
      order_history: [],
    });
  }
  return request('/customer/suppliers/' + id);
}
