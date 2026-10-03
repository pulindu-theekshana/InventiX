/**
 * Till identity and receipt numbers
 *
 * Purpose : The prefix that identifies this till, and the counter behind every receipt number. Both live on the device, because a till with no internet still has to number its bills.
 * Spec    : Section 6.6
 * Look here when : Two tills produce the same receipt number, or numbering restarts unexpectedly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextReceiptNo as askServer } from '../api/pos';

const DEVICE_KEY = 'pos.device_id';
const COUNTER_KEY = 'pos.receipt_counter';

/** Short, because a customer reads it off a receipt: T1, T2, COUNTER1. */
const DEFAULT_DEVICE = 'T1';

let cachedDevice: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDevice) return cachedDevice;
  cachedDevice = (await AsyncStorage.getItem(DEVICE_KEY)) ?? DEFAULT_DEVICE;
  return cachedDevice;
}

export async function setDeviceId(id: string): Promise<void> {
  const clean = id.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || DEFAULT_DEVICE;
  cachedDevice = clean;
  await AsyncStorage.setItem(DEVICE_KEY, clean);
}

/**
 * The next receipt number for this till, e.g. T1-000147.
 *
 * The counter is stored before it is handed out, so a bill that is interrupted still burns its
 * number. A gap in the numbering is a question the owner can answer; two bills sharing a number
 * is a return nobody can trace.
 */
export async function nextReceiptNo(): Promise<string> {
  const device = await getDeviceId();
  const current = Number((await AsyncStorage.getItem(COUNTER_KEY)) ?? '0') + 1;
  await AsyncStorage.setItem(COUNTER_KEY, String(current));
  return `${device}-${String(current).padStart(6, '0')}`;
}

/** Only for a till being set up on a laptop that has already sold under another number. */
export async function setReceiptCounter(value: number): Promise<void> {
  await AsyncStorage.setItem(COUNTER_KEY, String(Math.max(0, Math.floor(value))));
}

/**
 * Moves this till's counter forward if the shop is already past it.
 *
 * The counter lives on the device so a bill can be numbered with no connection. The cost is that
 * clearing the browser's data sends it back to 1, and every bill then collides with one already
 * stored -- which is what happened: three sales sat unsent for ever against a number the shop had
 * used. Asking the server once, while online, costs one request and removes the whole class of
 * failure. Never moves the counter backwards: two tills must not meet in the middle.
 */
export async function catchUpWithServer(): Promise<void> {
  try {
    const device = await getDeviceId();
    const suggested = await askServer(device); // 'T1-000004'
    const serverUsed = Number(suggested.split('-').pop() ?? '1') - 1;
    const localUsed = Number((await AsyncStorage.getItem(COUNTER_KEY)) ?? '0');
    if (serverUsed > localUsed) await AsyncStorage.setItem(COUNTER_KEY, String(serverUsed));
  } catch {
    // Offline, or the shop has no bills yet. The local counter stands.
  }
}
