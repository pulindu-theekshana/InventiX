/**
 * The till's own day
 *
 * Purpose : What the cashier counts the drawer against, built from the server when it answers and from the device when it does not — plus the bills that have not been sent yet.
 * Spec    : Section 6.6
 * Look here when : Day close is empty offline, or its total disagrees with the bills listed under it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { daySummary, listSales } from '../api/pos';
import * as cart from './cart';
import * as queue from './queue';
import type { DaySummary, Sale } from '../types/api';

const KEY = 'pos.day';

export interface TillDay {
  summary: DaySummary;
  bills: Sale[];
  /**
   * `server` — read just now. `saved` — the server could not be reached, so this is the last copy
   * plus anything billed since. `device` — nothing has ever been read for today; everything here
   * was rung on this till.
   */
  source: 'server' | 'saved' | 'device';
  /** When the server part was last read, so the screen can say how old it is. */
  serverAt: string | null;
  /** How many of the bills below are still waiting to be sent. */
  queued: number;
}

/**
 * A date as the device reads it, not as UTC does.
 *
 * `toISOString().slice(0, 10)` would be five and a half hours behind in Colombo, so a bill rung at
 * half past midnight would be filed under yesterday and vanish from the day close of the shift
 * that is still open.
 */
function localDay(when: Date = new Date()): string {
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
}

function emptySummary(date: string): DaySummary {
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

/**
 * A queued bill as the screen's own shape, so the list below does not have to know that some of
 * its rows have never left the building. The id is prefixed rather than invented: it must not
 * collide with a real one when the same bill arrives from the server after syncing.
 */
function asSale(row: queue.QueuedSale): Sale {
  const lines = row.sale.lines.map((l) => ({
    catalog_product_id: l.catalog_product_id,
    stock_item_id: l.stock_item_id,
    // The till sends ids, not names; the day list only counts lines, and tapping a queued bill
    // is not offered because the backend has never seen it.
    name: '',
    quantity: l.quantity,
    unit_price: l.unit_price,
    line_total: cart.money(l.quantity * l.unit_price),
    returned_quantity: 0,
  }));
  return {
    id: `queued-${row.sale.client_sale_id}`,
    receipt_no: row.sale.receipt_no,
    kind: 'sale',
    sold_at: row.sale.sold_at,
    payment_method: row.sale.payment_method,
    discount: row.sale.discount,
    total: cart.cartTotal(row.sale.lines, row.sale.discount),
    cashier_label: row.sale.cashier_label,
    lines,
  };
}

/** Adds a bill the server has never seen to the totals it therefore cannot include. */
function include(summary: DaySummary, bill: Sale): void {
  summary.bills += 1;
  summary.sales_total = cart.money(summary.sales_total + bill.total);
  if (bill.payment_method === 'cash') {
    summary.cash_expected = cart.money(summary.cash_expected + bill.total);
  } else if (bill.payment_method === 'card') {
    summary.card_total = cart.money(summary.card_total + bill.total);
  } else {
    summary.other_total = cart.money(summary.other_total + bill.total);
  }

  const name = bill.cashier_label ?? null;
  const person = summary.by_cashier.find((c) => c.cashier === name);
  if (person) {
    person.bills += 1;
    person.sales_total = cart.money(person.sales_total + bill.total);
  } else {
    summary.by_cashier.push({ cashier: name, bills: 1, sales_total: bill.total });
  }
}

/**
 * Today, as completely as this till can know it.
 *
 * The server knows the bills it has been sent; the device knows the ones it has not. Counting a
 * drawer needs both, and a till whose line is down at closing time is exactly when it is needed --
 * which is why this never fails: it falls back to the last copy and says which part is which.
 */
export async function readDay(): Promise<TillDay> {
  const date = localDay();
  let summary: DaySummary | null = null;
  let bills: Sale[] = [];
  let source: TillDay['source'] = 'device';
  let serverAt: string | null = null;

  try {
    const [s, b] = await Promise.all([daySummary(), listSales()]);
    summary = s;
    bills = b;
    source = 'server';
    serverAt = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify({ date, summary: s, bills: b, at: serverAt }));
  } catch {
    try {
      const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as
        | { date: string; summary: DaySummary; bills: Sale[]; at: string }
        | null;
      // Yesterday's copy is not today's day close. Better to show only what is on the till than
      // a figure from a day the cashier is not counting.
      if (saved && saved.date === date) {
        summary = saved.summary;
        bills = saved.bills;
        source = 'saved';
        serverAt = saved.at;
      }
    } catch {
      // Unreadable storage. The queued bills below are still worth showing.
    }
  }

  const merged: DaySummary = summary
    ? { ...summary, by_cashier: summary.by_cashier.map((c) => ({ ...c })) }
    : emptySummary(date);

  const waiting = (await queue.pending()).filter(
    (row) => localDay(new Date(row.sale.sold_at)) === date,
  );
  const queuedBills = waiting.map(asSale);
  queuedBills.forEach((bill) => include(merged, bill));

  merged.by_cashier.sort((a, b) => b.sales_total - a.sales_total);
  const all = [...queuedBills, ...bills].sort((a, b) => b.sold_at.localeCompare(a.sold_at));

  return { summary: merged, bills: all, source, serverAt, queued: queuedBills.length };
}
