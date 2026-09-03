/**
 * Uploads API
 * 
 * Purpose : Calls the sales upload feed.
 * Spec    : Section 6.6
 * Look here when : An upload step fails from the app.
 */

import { mock, request, useMockData } from './client';
import type { UploadStatus } from '../types/database';

export interface UploadSession {
  id: string;
  file_name: string;
  status: UploadStatus;
  row_count: number;
  unmatched_count: number;
  columns: string[];
  /** Pre-filled from the shop's previous upload, so mapping is a one-time cost. Spec 6.6. */
  suggested_mapping: { product: string | null; quantity: string | null; date: string | null };
}

export interface UnmatchedRow {
  pos_product_name: string;
  occurrences: number;
  /** What the owner picks. Saved as an alias and reused forever after. Spec 5.9. */
  catalog_product_id: string | null;
}

/**
 * Spec 6.6 — the backend hashes the file and rejects a duplicate, so stock is never
 * decremented twice from the same report.
 */
export async function startUpload(fileName: string): Promise<UploadSession> {
  if (useMockData) {
    return mock({
      id: 'u-new',
      file_name: fileName,
      status: 'needs_mapping' as UploadStatus,
      row_count: 248,
      unmatched_count: 3,
      columns: ['Item Code', 'Item Name', 'Qty Sold', 'Unit Price', 'Sale Date', 'Cashier'],
      suggested_mapping: { product: 'Item Name', quantity: 'Qty Sold', date: 'Sale Date' },
    });
  }
  return request('/customer/uploads', { method: 'POST', body: JSON.stringify({ file_name: fileName }) });
}

export async function saveMapping(
  uploadId: string,
  mapping: { product: string; quantity: string; date: string },
): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/uploads/' + uploadId + '/mapping', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
}

export async function getUnmatched(uploadId: string): Promise<UnmatchedRow[]> {
  if (useMockData) {
    return mock([
      { pos_product_name: 'RICE-NADU-5KG', occurrences: 42, catalog_product_id: null },
      { pos_product_name: 'SUGAR WHT 1K', occurrences: 18, catalog_product_id: null },
      { pos_product_name: 'MILK PWD HL 400', occurrences: 7, catalog_product_id: null },
    ]);
  }
  return request('/customer/uploads/' + uploadId + '/unmatched');
}

/** Saves the choice as a pos_product_aliases row, so the same name matches next time. */
export async function resolveUnmatched(
  uploadId: string,
  posProductName: string,
  catalogProductId: string | null,
): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/uploads/' + uploadId + '/unmatched', {
    method: 'POST',
    body: JSON.stringify({ pos_product_name: posProductName, catalog_product_id: catalogProductId }),
  });
}

/** Writes sales_records, reduces quantities, and writes a stock_adjustments row for each. */
export async function applyUpload(uploadId: string): Promise<void> {
  if (useMockData) return mock(undefined, 600);
  return request('/customer/uploads/' + uploadId + '/apply', { method: 'POST' });
}
