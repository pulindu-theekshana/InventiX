/**
 * Till settings
 *
 * Purpose : The shop's cashiers, the owner's PIN and the limits, kept on the device so the till still locks with no connection.
 * Spec    : Section 6.6
 * Look here when : The till does not ask for a PIN it should, or a new cashier does not appear at the counter.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings, saveSettings } from '../api/pos';
import type { PosSettings } from '../types/api';

const KEY = 'pos.settings';

/** No PIN set means the till does not lock: the right default for a shop with no cashier. */
export const DEFAULTS: PosSettings = {
  owner_pin_hash: null,
  discount_limit: 100,
  return_limit: 500,
  cashiers: [],
};

let cache: PosSettings | null = null;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Reads what this device already knows, and waits for the server only when it knows nothing.
 *
 * The first version returned an empty copy immediately and refreshed in the background, so a
 * screen asked "are there cashiers?" before the answer existed and showed "none added yet" to a
 * shop that had three. Waiting the first time is the honest trade: it is one request, once.
 */
export async function load(): Promise<PosSettings> {
  if (cache) {
    void refresh();
    return cache;
  }

  try {
    const stored = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as PosSettings | null;
    if (stored) {
      cache = stored;
      void refresh();
      return stored;
    }
  } catch {
    // Unreadable storage is not worth stopping the till for; ask the server instead.
  }

  return (await refresh()) ?? DEFAULTS;
}

export async function refresh(): Promise<PosSettings | null> {
  try {
    const fresh = await getSettings();
    cache = fresh;
    await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
    // Screens that are already open follow the new answer rather than the one they opened with.
    listeners.forEach((l) => l());
    return fresh;
  } catch {
    // Offline, or not signed in yet. The cached copy stays in force.
    return null;
  }
}

export async function save(next: PosSettings): Promise<PosSettings> {
  const stored = await saveSettings(next);
  cache = stored;
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  listeners.forEach((l) => l());
  return stored;
}

/** Synchronous read for screens that have already awaited load(). */
export function current(): PosSettings {
  return cache ?? DEFAULTS;
}

/**
 * Whether the owner has to be asked about an amount.
 *
 * No owner PIN set means no lock at all, so there is nothing to approve with -- asking then would
 * put up a prompt that can never be satisfied, which is worse than not asking. A shop turns the
 * guards on by setting a PIN, not by having a limit.
 */
export function needsOwner(amount: number, limit: number): boolean {
  return Boolean(current().owner_pin_hash) && amount > limit;
}

/** For the actions that are not about an amount: leaving the till, opening settings. */
export function locked(): boolean {
  return Boolean(current().owner_pin_hash);
}
