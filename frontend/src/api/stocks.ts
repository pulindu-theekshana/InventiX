/**
 * Stocks API
 * 
 * Purpose : Calls the customer stocks feed. Mirrors backend feeds customer stocks.
 * Spec    : Section 6
 * Look here when : A stocks screen shows no data.
 */

import { mock, request, useMockData } from './client';
import { CATALOG } from './catalog';
import type { SeasonalWarning, StockItemView, StockStatus, StockSummary } from '../types/api';
import type { StockAdjustment } from '../types/database';

const by = (id: string) => CATALOG.find((p) => p.id === id)!;

/** Spec 6.2 — the same three-way rule the backend uses, so the chart and the list agree. */
function classify(quantity: number, threshold: number, requested: boolean): StockStatus {
  if (quantity > threshold) return 'in_stock';
  return requested ? 'restock_requested' : 'low_stock';
}

function item(
  id: string,
  productId: string,
  quantity: number,
  threshold: number,
  price: number,
  requested = false,
  supplier: string | null = null,
): StockItemView {
  return {
    id,
    product: by(productId),
    quantity_on_hand: quantity,
    low_threshold: threshold,
    restock_requested: requested,
    preferred_supplier_id: supplier ? 's1' : null,
    preferred_supplier_name: supplier,
    unit_price: price,
    status: classify(quantity, threshold, requested),
  };
}

const STOCKS: StockItemView[] = [
  item('si1', 'p1', 120, 30, 1250, false, 'Lanka Traders (pvt) Ltd'),
  item('si2', 'p3', 85, 20, 260, false, 'Lanka Traders (pvt) Ltd'),
  item('si3', 'p9', 43, 15, 780, false, 'Global Suppliers & CO'),
  item('si4', 'p10', 56, 20, 780, false, 'Global Suppliers & CO'),
  item('si5', 'p11', 34, 10, 990, false, null),
  item('si6', 'p7', 15, 12, 350, false, 'Lanka Traders (pvt) Ltd'),
  item('si7', 'p5', 12, 25, 1180, false, 'Lanka Traders (pvt) Ltd'),
  item('si8', 'p2', 5, 15, 3250, false, 'Tech Solutions Ltd'),
  item('si9', 'p4', 7, 20, 260, false, 'Lanka Traders (pvt) Ltd'),
  item('si10', 'p6', 8, 25, 1180, true, 'Global Suppliers & CO'),
  item('si11', 'p8', 4, 12, 350, true, 'Lanka Traders (pvt) Ltd'),
  item('si12', 'p12', 9, 18, 690, false, 'Prime Distributors'),
];

const ADJUSTMENTS: StockAdjustment[] = [
  { id: 'a1', stock_item_id: 'si7', change_quantity: -18, quantity_after: 12, reason: 'sales_upload', source_id: 'u1', created_by: 'demo-user', created_at: '2026-08-28T09:12:00Z' },
  { id: 'a2', stock_item_id: 'si7', change_quantity: -5, quantity_after: 30, reason: 'manual', source_id: null, created_by: 'demo-user', created_at: '2026-08-21T14:40:00Z' },
  { id: 'a3', stock_item_id: 'si7', change_quantity: 40, quantity_after: 35, reason: 'order_received', source_id: 'o3', created_by: 'demo-user', created_at: '2026-08-14T11:05:00Z' },
];

export async function listStocks(): Promise<StockItemView[]> {
  if (useMockData) return mock(STOCKS);
  return request('/customer/stocks');
}

export async function getSummary(): Promise<StockSummary> {
  if (useMockData) {
    return mock({
      total: STOCKS.length,
      in_stock: STOCKS.filter((s) => s.status === 'in_stock').length,
      low_stock: STOCKS.filter((s) => s.status === 'low_stock').length,
      restock_requested: STOCKS.filter((s) => s.status === 'restock_requested').length,
    });
  }
  return request('/customer/stocks/summary');
}

export async function getStockItem(id: string): Promise<StockItemView | null> {
  if (useMockData) return mock(STOCKS.find((s) => s.id === id) ?? null);
  return request(`/customer/stocks/${id}`);
}

export async function getAdjustments(stockItemId: string): Promise<StockAdjustment[]> {
  if (useMockData) return mock(ADJUSTMENTS.filter((a) => a.stock_item_id === stockItemId));
  return request(`/customer/stocks/${stockItemId}/adjustments`);
}

/** Spec 6.2 — seasonal windows are a date comparison in the backend, not machine learning. */
export async function getSeasonalWarnings(): Promise<SeasonalWarning[]> {
  if (useMockData) {
    return mock([
      {
        id: 'ev1',
        name: 'Christmas',
        event_date: '2026-12-25',
        weeks_away: 16,
        affected_categories: ['Biscuits', 'Dairy', 'Sugar'],
        products: [
          { stock_item_id: 'si6', name: 'Maliban Tikiri Mari Biscuits', pack_size: '400 g', suggested_quantity: 45 },
          { stock_item_id: 'si7', name: 'Highland Milk Powder', pack_size: '400 g', suggested_quantity: 60 },
          { stock_item_id: 'si2', name: 'White Sugar', pack_size: '1 kg', suggested_quantity: 130 },
        ],
      },
    ]);
  }
  return request('/customer/stocks/seasonal');
}

/**
 * Spec 6.6 and 5.10: every quantity change writes a stock_adjustments row, and only
 * domain/stock.py in the backend may perform one. The app never writes a quantity itself.
 */
export async function adjustQuantity(
  stockItemId: string,
  changeQuantity: number,
  reason: string,
): Promise<void> {
  if (useMockData) return mock(undefined);
  return request(`/customer/stocks/${stockItemId}/adjust`, {
    method: 'POST',
    body: JSON.stringify({ change_quantity: changeQuantity, reason }),
  });
}

export async function updateThreshold(stockItemId: string, threshold: number): Promise<void> {
  if (useMockData) return mock(undefined);
  return request(`/customer/stocks/${stockItemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ low_threshold: threshold }),
  });
}

export async function addStockItem(input: {
  catalog_product_id: string;
  quantity_on_hand: number;
  low_threshold: number;
}): Promise<void> {
  if (useMockData) return mock(undefined);
  return request('/customer/stocks', { method: 'POST', body: JSON.stringify(input) });
}
