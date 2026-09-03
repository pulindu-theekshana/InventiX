/**
 * Catalog API
 * 
 * Purpose : Calls the shared catalog feed.
 * Spec    : Section 5.2
 * Look here when : Product search shows nothing.
 */

import { mock, request, useMockData } from './client';
import type { CatalogProduct } from '../types/database';

export const CATALOG: CatalogProduct[] = [
  { id: 'p1', name: 'Araliya Keeri Samba Rice', category: 'Rice', pack_size: '5 kg', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p2', name: 'Araliya Basmathi Rice', category: 'Rice', pack_size: '8 kg', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p3', name: 'White Sugar', category: 'Sugar', pack_size: '1 kg', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p4', name: 'Brown Sugar', category: 'Sugar', pack_size: '1 kg', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p5', name: 'Highland Milk Powder', category: 'Dairy', pack_size: '400 g', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p6', name: 'Anchor Milk Powder', category: 'Dairy', pack_size: '400 g', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p7', name: 'Maliban Tikiri Mari Biscuits', category: 'Biscuits', pack_size: '400 g', unit: 'packet', barcode: null, is_seasonal: true, is_active: true },
  { id: 'p8', name: 'Maliban Lemon Puff Biscuits', category: 'Biscuits', pack_size: '400 g', unit: 'packet', barcode: null, is_seasonal: true, is_active: true },
  { id: 'p9', name: 'Dhal', category: 'Groceries', pack_size: '500 g', unit: 'packet', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p10', name: 'Sunflower Cooking Oil', category: 'Groceries', pack_size: '1 L', unit: 'bottle', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p11', name: 'Dilmah Pure Green Tea', category: 'Beverages', pack_size: '40 g', unit: 'box', barcode: null, is_seasonal: false, is_active: true },
  { id: 'p12', name: 'Coconut Oil', category: 'Groceries', pack_size: '750 ml', unit: 'bottle', barcode: null, is_seasonal: true, is_active: true },
];

export async function searchCatalog(query: string): Promise<CatalogProduct[]> {
  if (useMockData) {
    const q = query.trim().toLowerCase();
    return mock(q ? CATALOG.filter((p) => p.name.toLowerCase().includes(q)) : CATALOG);
  }
  return request(`/catalog/search?q=${encodeURIComponent(query)}`);
}
