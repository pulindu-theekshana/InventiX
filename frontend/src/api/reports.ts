/**
 * Reports API
 * 
 * Purpose : Calls the reports feed. The inventory report is generated on request from stock levels; the sales reports wait on sales history, which does not exist until a sales report has been uploaded.
 * Spec    : Section 7
 * Look here when : Reports show no data.
 */

import { mock, request, useMockData } from './client';
import type { InventoryReport, ReportSection } from '../types/api';

/**
 * Spec 7.1 — the five reports that need no machine learning. Each becomes a plain database
 * query once sales_records and orders carry data. The four models in 7.2 come later.
 */
export const REPORT_SECTIONS: ReportSection[] = [
  {
    key: 'stock-movement',
    title: 'Stock movement',
    description: 'How one product has risen and fallen over a chosen period.',
    icon: 'trending-up-outline',
  },
  {
    key: 'best-worst',
    title: 'Best and worst sellers',
    description: 'Which products move fastest, and which sit on the shelf.',
    icon: 'podium-outline',
  },
  {
    key: 'spend-by-supplier',
    title: 'Spend by supplier',
    description: 'What you have spent with each supplier over a period.',
    icon: 'wallet-outline',
  },
  {
    key: 'delivery-times',
    title: 'Order history and delivery times',
    description: 'Every order, and how long each supplier actually took.',
    icon: 'time-outline',
  },
  {
    key: 'stock-outs',
    title: 'Stock-out events',
    description: 'How often a product reached zero, and which ones.',
    icon: 'alert-circle-outline',
  },
];

export async function listSections(): Promise<ReportSection[]> {
  if (useMockData) return mock(REPORT_SECTIONS);
  return request('/customer/reports');
}

/**
 * Spec 7.1. Generated on request rather than stored: it reads current stock levels and the
 * adjustment trail, so pressing Generate always reflects the shelf as it is now.
 */
export async function generateInventoryReport(days = 30): Promise<InventoryReport> {
  if (useMockData) return mock(MOCK_INVENTORY_REPORT, 600);
  return request(`/customer/reports/inventory?days=${days}`);
}

/** Only reachable before EXPO_PUBLIC_API_URL is set. Shapes the screen, never shown as real. */
const MOCK_INVENTORY_REPORT: InventoryReport = {
  generated_at: new Date().toISOString(),
  days: 30,
  total_products: 3,
  total_units: 142,
  total_value: 48200,
  priced_products: 2,
  in_stock: 1,
  low_stock: 1,
  restock_requested: 1,
  at_zero: 0,
  trend: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    total_units: 190 - i * 1.6 + (i % 5) * 4,
  })).map((p) => ({ ...p, total_units: Math.round(p.total_units) })),
  items: [
    { stock_item_id: 'm1', name: 'Maliban Tikiri Mari Biscuits', pack_size: '400 g', quantity_on_hand: 5, low_threshold: 12, unit_price: 345, value: 1725, status: 'low_stock' },
    { stock_item_id: 'm2', name: 'Highland Milk Powder', pack_size: '400 g', quantity_on_hand: 7, low_threshold: 25, unit_price: 1180, value: 8260, status: 'restock_requested' },
    { stock_item_id: 'm3', name: 'Araliya Keeri Samba Rice', pack_size: '5 kg', quantity_on_hand: 130, low_threshold: 30, unit_price: 1250, value: 162500, status: 'in_stock' },
  ],
};
