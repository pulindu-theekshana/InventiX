/**
 * Reports API
 * 
 * Purpose : Calls the reports feed. Sections only for now, with no figures and no charts, because spec 7 builds this last and there is no sales history to draw from yet.
 * Spec    : Section 7
 * Look here when : Reports show no data.
 */

import { mock, request, useMockData } from './client';
import type { ReportSection } from '../types/api';

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
