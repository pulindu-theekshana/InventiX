/**
 * Shift
 *
 * Purpose : Who is standing at the till right now. Every bill carries that name, so a day's takings can be read per person.
 * Spec    : Section 6.6
 * Look here when : Bills have no cashier name, or the till keeps asking who is on.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pos.shift';

type Listener = () => void;
const listeners = new Set<Listener>();
let cashier: string | null = null;
let loaded = false;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Kept across reloads on purpose: a browser refresh in the middle of a rush should not stop the
 * counter to ask who is on. Ending a shift is deliberate, at day close or when handing over.
 */
export async function load(): Promise<string | null> {
  if (!loaded) {
    cashier = await AsyncStorage.getItem(KEY);
    loaded = true;
  }
  return cashier;
}

export function current(): string | null {
  return cashier;
}

export async function start(name: string): Promise<void> {
  cashier = name;
  loaded = true;
  await AsyncStorage.setItem(KEY, name);
  listeners.forEach((l) => l());
}

export async function end(): Promise<void> {
  cashier = null;
  await AsyncStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
