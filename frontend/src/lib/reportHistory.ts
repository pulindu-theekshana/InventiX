/**
 * Report history
 *
 * Purpose : Remembers which reports this shop has generated, so the Reports screen can list recent ones and count them. Stored on the device with AsyncStorage, because nothing about a generated report needs to reach the backend.
 * Spec    : Section 7.1
 * Look here when : Recent reports is empty after generating one, or the count is wrong.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'inventix.reportHistory.v1';
/** Enough to fill the list without letting the device store grow forever. */
const LIMIT = 20;

export interface GeneratedReport {
  id: string;
  kind: 'inventory' | 'sales';
  /** What the file would be called, which is also what reads best in the list. */
  name: string;
  generated_at: string;
  /** The window the report covered, so an old entry still says what it measured. */
  days: number;
  /** A one-line summary, so the list says something without re-running the report. */
  summary: string;
}

export async function listReports(): Promise<GeneratedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GeneratedReport[]) : [];
  } catch {
    /* A device that cannot read its own store is not a reason to fail the screen. */
    return [];
  }
}

export async function recordReport(
  entry: Omit<GeneratedReport, 'id' | 'generated_at'>,
): Promise<GeneratedReport[]> {
  const item: GeneratedReport = {
    ...entry,
    id: Date.now().toString(36),
    generated_at: new Date().toISOString(),
  };
  const next = [item, ...(await listReports())].slice(0, LIMIT);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage full or unavailable. The report itself still generated, which is what matters. */
  }
  return next;
}

/** Inventory_report_15Sep2026 — the form the Figma list uses. */
export function reportName(kind: GeneratedReport['kind'], when = new Date()): string {
  const stamp = when
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '');
  return `${kind === 'inventory' ? 'Inventory' : 'Sales'}_report_${stamp}`;
}
