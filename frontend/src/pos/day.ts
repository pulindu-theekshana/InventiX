/**
 * The till's own day
 *
 * Purpose : What the cashier counts the drawer against: the server when it answers, the last copy when it does not, and always the bills still waiting to be sent. The arithmetic itself is in dayMath.ts.
 * Spec    : Section 6.6
 * Look here when : Day close is empty offline, or its total disagrees with the bills listed under it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { daySummary, listSales } from '../api/pos';
import { byNewest, localDay, mergeDay, queuedAsSale } from './dayMath';
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

  const waiting = (await queue.pending()).filter(
    (row) => localDay(new Date(row.sale.sold_at)) === date,
  );
  const queuedBills = waiting.map(queuedAsSale);

  return {
    summary: mergeDay(summary, queuedBills, date),
    bills: byNewest([...queuedBills, ...bills]),
    source,
    serverAt,
    queued: queuedBills.length,
  };
}
