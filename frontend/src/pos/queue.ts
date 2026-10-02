/**
 * Till outbox
 *
 * Purpose : A sale is written to the device first and sent afterwards, so billing never waits for the network. This module owns that queue: adding to it, retrying it, and reporting what is still unsent.
 * Spec    : Section 6.6
 * Look here when : Sales never reach the backend, a sale is sent twice, or the "waiting to sync" count is wrong.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordSale } from '../api/pos';
import { ApiError } from '../lib/errors';
import type { SalePayload } from '../types/api';

const KEY = 'pos.outbox';

export interface QueuedSale {
  sale: SalePayload;
  /**
   * `waiting` is normal, `stuck` means the backend refused the bill itself — a wrong product,
   * a bad receipt number. Retrying a refusal forever would hide it, so it is separated out and
   * surfaced to the owner instead.
   */
  status: 'waiting' | 'stuck';
  attempts: number;
  lastError: string | null;
  queuedAt: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: QueuedSale[] | null = null;
let syncing = false;
/** When the current run started, so a run that somehow hangs cannot block the queue for ever. */
let syncStartedAt = 0;
const RUN_LOOKS_STUCK_MS = 60_000;

/**
 * AsyncStorage, not a database: a day of bills is a few hundred small rows, and this is one
 * module so the storage can become SQLite later without a single screen changing. The limit is
 * honest — browser storage can be cleared by the person using it, so a till that stays offline
 * for days is not yet safe. See docs/16-pos-system.md.
 */
async function load(): Promise<QueuedSale[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]') as QueuedSale[];
  } catch {
    // Unreadable storage must not stop the till selling. Start clean rather than crash.
    cache = [];
  }
  return cache;
}

async function save(next: QueuedSale[]): Promise<void> {
  cache = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Everything not yet accepted by the backend, oldest first. */
export async function pending(): Promise<QueuedSale[]> {
  return [...(await load())];
}

export async function counts(): Promise<{ waiting: number; stuck: number }> {
  const rows = await load();
  return {
    waiting: rows.filter((r) => r.status === 'waiting').length,
    stuck: rows.filter((r) => r.status === 'stuck').length,
  };
}

/**
 * Step one of finishing a bill. Stored, then sent.
 *
 * The send is deliberately not awaited by the caller: the receipt prints and the next customer
 * is served whether or not the network answers.
 */
export async function enqueue(sale: SalePayload): Promise<void> {
  const rows = await load();
  await save([
    ...rows,
    { sale, status: 'waiting', attempts: 0, lastError: null, queuedAt: new Date().toISOString() },
  ]);
  void sync();
}

/**
 * Tries every waiting bill, oldest first, and keeps the ones that did not get through.
 *
 * Only one run at a time: two overlapping runs would send the same bill twice. That would be
 * survivable -- the backend keys on client_sale_id -- but it would double the traffic of a till
 * that is already struggling with its connection.
 */
export async function sync(): Promise<{ sent: number; left: number }> {
  if (syncing && Date.now() - syncStartedAt < RUN_LOOKS_STUCK_MS) {
    return { sent: 0, left: (await load()).length };
  }
  syncing = true;
  syncStartedAt = Date.now();
  try {
    const rows = await load();
    const keep: QueuedSale[] = [];
    let sent = 0;

    for (const row of rows) {
      if (row.status === 'stuck') {
        keep.push(row);
        continue;
      }
      try {
        await recordSale(row.sale);
        sent += 1;
      } catch (error) {
        /**
         * A 4xx is the backend saying this bill is wrong; sending it again changes nothing.
         * Anything else -- no network, a timeout, a 500 -- is worth retrying, so it stays
         * `waiting`. 401 is the exception: the till's session has expired and will be renewed,
         * so that one is retried too.
         */
        const status = error instanceof ApiError ? error.status : 0;
        const permanent = status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
        keep.push({
          ...row,
          status: permanent ? 'stuck' : 'waiting',
          attempts: row.attempts + 1,
          lastError: error instanceof Error ? error.message : 'Could not reach the backend.',
        });
      }
    }

    await save(keep);
    return { sent, left: keep.length };
  } finally {
    syncing = false;
  }
}

/**
 * Removes a bill the backend will never accept, once the owner has seen it. Deliberately manual:
 * dropping a sale silently is how takings go missing.
 */
/** The newest failure, so a screen can say why rather than only how many. */
export async function lastError(): Promise<string | null> {
  const rows = await load();
  return rows.find((r) => r.lastError)?.lastError ?? null;
}

export async function discard(clientSaleId: string): Promise<void> {
  const rows = await load();
  await save(rows.filter((r) => r.sale.client_sale_id !== clientSaleId));
}

/** For tests and for a till being handed to a different shop. */
export async function clear(): Promise<void> {
  await save([]);
}
