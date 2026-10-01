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

/**
 * Cached, then refreshed in the background. A till that could only lock while online would
 * unlock itself exactly when the shop's connection drops, which is backwards.
 */
export async function load(): Promise<PosSettings> {
  if (!cache) {
    try {
      cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') ?? DEFAULTS;
    } catch {
      cache = DEFAULTS;
    }
  }
  void refresh();
  return cache as PosSettings;
}

export async function refresh(): Promise<PosSettings | null> {
  try {
    const fresh = await getSettings();
    cache = fresh;
    await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
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
