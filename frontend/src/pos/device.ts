/**
 * Till identity and receipt numbers
 *
 * Purpose : The prefix that identifies this till, and the counter behind every receipt number. Both live on the device, because a till with no internet still has to number its bills.
 * Spec    : Section 6.6
 * Look here when : Two tills produce the same receipt number, or numbering restarts unexpectedly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

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
