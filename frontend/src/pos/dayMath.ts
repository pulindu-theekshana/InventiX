/**
 * Day close arithmetic
 *
 * Purpose : Turning the bills a till knows about into the figure a cashier counts the drawer against. No storage and no network, so it can be tested.
 * Spec    : Section 6.6
 * Look here when : The drawer total disagrees with the bills listed under it.
 */

import * as cart from './cart';
import type { QueuedSale } from './queue';
import type { DaySummary, Sale } from '../types/api';

/**
 * A date as the device reads it, not as UTC does.
 *
 * `toISOString().slice(0, 10)` would be five and a half hours behind in Colombo, so a bill rung at
 * half past midnight would be filed under yesterday and vanish from the day close of the shift
 * that is still open.
 */
export function localDay(when: Date = new Date()): string {
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
}

export function emptySummary(date: string): DaySummary {
  return {
    date,
    bills: 0,
    sales_total: 0,
    returns_total: 0,
    cash_expected: 0,
    card_total: 0,
    other_total: 0,
    by_cashier: [],
  };
}

/** True for a bill built from the outbox rather than read back from the backend. */
export function isQueued(bill: Sale): boolean {
  return bill.id.startsWith('queued-');
}

/**
 * A queued bill in the shape the screen already knows, so the list below does not have to learn
 * that some of its rows have never left the building. The id is prefixed rather than invented: it
 * must not collide with a real one when the same bill arrives from the server after syncing.
 */
export function queuedAsSale(row: QueuedSale): Sale {
  return {
    id: `queued-${row.sale.client_sale_id}`,
    receipt_no: row.sale.receipt_no,
    kind: 'sale',
    sold_at: row.sale.sold_at,
    payment_method: row.sale.payment_method,
    discount: row.sale.discount,
    total: cart.cartTotal(row.sale.lines, row.sale.discount),
    cashier_label: row.sale.cashier_label,
    lines: row.sale.lines.map((l) => ({
      catalog_product_id: l.catalog_product_id,
      stock_item_id: l.stock_item_id,
      // The till sends ids, not names; the day list only counts lines, and a queued bill cannot
      // be opened for a return anyway.
      name: '',
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_total: cart.lineTotal(l),
      returned_quantity: 0,
      price_from_till: l.price_from_till,
    })),
  };
}

/**
 * The day as the till knows it: what the backend has been sent, plus what is still waiting here.
 *
 * Adding the queued bills is correct rather than double counting, because the backend has not
 * seen them -- `pos/queue.ts` drops a bill only once it has been accepted. The one case that
 * would double count is a bill accepted whose reply was lost, and the receipt number repeating in
 * the list is how that shows itself.
 */
export function mergeDay(
  server: DaySummary | null,
  queued: Sale[],
  date: string = localDay(),
): DaySummary {
  const merged: DaySummary = server
    ? { ...server, by_cashier: server.by_cashier.map((c) => ({ ...c })) }
    : emptySummary(date);

  for (const bill of queued) {
    merged.bills += 1;
    merged.sales_total = cart.money(merged.sales_total + bill.total);
    if (bill.payment_method === 'cash') {
      merged.cash_expected = cart.money(merged.cash_expected + bill.total);
    } else if (bill.payment_method === 'card') {
      merged.card_total = cart.money(merged.card_total + bill.total);
    } else {
      merged.other_total = cart.money(merged.other_total + bill.total);
    }

    const name = bill.cashier_label ?? null;
    const person = merged.by_cashier.find((c) => c.cashier === name);
    if (person) {
      person.bills += 1;
      person.sales_total = cart.money(person.sales_total + bill.total);
    } else {
      merged.by_cashier.push({ cashier: name, bills: 1, sales_total: bill.total });
    }
  }

  merged.by_cashier.sort((a, b) => b.sales_total - a.sales_total);
  return merged;
}

/** Newest first, with the queued ones in their right place by time rather than bolted on top. */
export function byNewest(bills: Sale[]): Sale[] {
  return [...bills].sort((a, b) => b.sold_at.localeCompare(a.sold_at));
}
