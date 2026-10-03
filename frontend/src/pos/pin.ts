/**
 * Till PINs
 *
 * Purpose : Turns a typed PIN into the hash the shop stores, and checks one against it. The number itself never leaves the device.
 * Spec    : Section 6.6
 * Look here when : A correct PIN is refused, or a PIN set on one device is not accepted on another.
 */

import * as Crypto from 'expo-crypto';

/**
 * Salted with the shop's own id, so two shops that both choose 1234 do not share a hash, and a
 * hash copied from one shop's settings is useless in another.
 *
 * Honest about the strength: four digits is ten thousand possibilities, so anyone holding the
 * hash can find the PIN. This is a lock on the screens of a shared laptop, not a secret — the
 * boundary that actually holds is a separate cashier account with its own permissions.
 */
export async function hashPin(pin: string, shopId: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `inventix:${shopId}:${pin.trim()}`,
  );
}

export async function pinMatches(pin: string, hash: string | null, shopId: string): Promise<boolean> {
  if (!hash) return false;
  return (await hashPin(pin, shopId)) === hash;
}

/** Four to six digits. Longer is not a PIN, and letters are not typeable on a till keypad. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin.trim());
}
