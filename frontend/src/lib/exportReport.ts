/**
 * Report export
 *
 * Purpose : Turns a generated report into a CSV file on the device and opens the share sheet, so it can be saved, emailed or sent to an accountant.
 * Spec    : Section 7.1
 * Look here when : Export does nothing, or the saved file opens with the columns run together.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { InventoryReport } from '../types/api';

/**
 * CSV rather than PDF or xlsx. It is the one format that needs no library to write and that
 * Excel, Google Sheets and every accounting package open directly.
 */
const MIME = 'text/csv';

/** Quotes a value so a product name containing a comma cannot shift every column after it. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(',');
}

export function inventoryCsv(r: InventoryReport, shopName: string): string {
  const lines = [
    row(['InventiX — Stock on hand']),
    row(['Shop', shopName]),
    row(['Generated', new Date(r.generated_at).toLocaleString('en-GB')]),
    row(['Period', `Last ${r.days} days`]),
    '',
    row(['Products', r.total_products]),
    row(['Units on hand', r.total_units]),
    row(['Stock value (LKR)', r.total_value ?? '']),
    row(['Priced products', `${r.priced_products} of ${r.total_products}`]),
    row(['In stock', r.in_stock]),
    row(['Low stock', r.low_stock]),
    row(['Restock requested', r.restock_requested]),
    row(['At zero', r.at_zero]),
    '',
    row(['Product', 'Pack size', 'Quantity on hand', 'Low threshold', 'Unit price (LKR)', 'Value (LKR)', 'Status']),
    ...r.items.map((i) =>
      row([i.name, i.pack_size, i.quantity_on_hand, i.low_threshold, i.unit_price, i.value, i.status]),
    ),
    '',
    row(['Date', 'Total units']),
    ...r.trend.map((p) => row([p.date, p.total_units])),
  ];
  return lines.join('\n');
}

/**
 * Writes the file into the cache directory and hands it to the system share sheet. Cache
 * rather than documents: once it has been shared the copy here is disposable, and the OS may
 * reclaim it. Returns false when the device offers no way to share, so the caller can say so
 * rather than appearing to do nothing.
 */
export async function shareCsv(filename: string, contents: string): Promise<boolean> {
  const file = new File(Paths.cache, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);

  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: MIME,
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Save or send this report',
  });
  return true;
}
