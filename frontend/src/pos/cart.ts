/**
 * Cart rules and parked bills
 *
 * Purpose : The arithmetic behind the sell screen, and the bills a cashier sets aside while a customer fetches one more item.
 * Spec    : Section 6.6
 * Look here when : A cart total is wrong, or a parked bill cannot be brought back.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StockItemView } from '../types/api';

const PARKED_KEY = 'pos.parked';

export interface CartLine {
  stock_item_id: string | null;
  catalog_product_id: string;
  name: string;
  pack_size: string;
  /** Decimal: rice and dhal are sold by weight. */
  quantity: number;
  unit_price: number;
  /** What the shop is recorded as holding, so the screen can warn without refusing the sale. */
  quantity_on_hand: number | null;
}

export interface ParkedBill {
  id: string;
  label: string;
  lines: CartLine[];
  parkedAt: string;
}

export function lineOf(item: StockItemView, quantity = 1): CartLine {
  return {
    stock_item_id: item.id,
    catalog_product_id: item.product.id,
    name: item.product.name,
    pack_size: item.product.pack_size,
    quantity,
    unit_price: item.unit_price ?? 0,
    quantity_on_hand: item.quantity_on_hand,
  };
}

/** Scanning the same product twice adds to the line rather than making a second one. */
export function addLine(lines: CartLine[], next: CartLine): CartLine[] {
  const found = lines.findIndex((l) => l.catalog_product_id === next.catalog_product_id);
  if (found < 0) return [...lines, next];
  return lines.map((l, i) =>
    i === found ? { ...l, quantity: round3(l.quantity + next.quantity) } : l,
  );
}

export function setQuantity(lines: CartLine[], index: number, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((_, i) => i !== index);
  return lines.map((l, i) => (i === index ? { ...l, quantity: round3(quantity) } : l));
}

/** Three decimals: scales weigh to the gram, and 0.1 + 0.2 is famously not 0.3. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Takes anything priced: a cart line, or a line read back off a queued bill (pos/day.ts). */
export function lineTotal(line: { quantity: number; unit_price: number }): number {
  return money(line.quantity * line.unit_price);
}

/**
 * What the customer pays. The backend computes this again from the same lines and stores its own
 * answer -- this one is for the screen, so the cashier sees the total before the network does.
 */
export function cartTotal(lines: { quantity: number; unit_price: number }[], discount = 0): number {
  const gross = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  return money(Math.max(gross - discount, 0));
}

export function change(total: number, cashGiven: number): number {
  return money(Math.max(cashGiven - total, 0));
}

/* -------------------------------------------------------------- parked bills */

export async function listParked(): Promise<ParkedBill[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(PARKED_KEY)) ?? '[]') as ParkedBill[];
  } catch {
    return [];
  }
}

export async function park(lines: CartLine[], label: string): Promise<void> {
  const rows = await listParked();
  const bill: ParkedBill = {
    id: `${Date.now()}`,
    label: label.trim() || 'Bill',
    lines,
    parkedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(PARKED_KEY, JSON.stringify([...rows, bill]));
}

export async function unpark(id: string): Promise<CartLine[]> {
  const rows = await listParked();
  const found = rows.find((r) => r.id === id);
  await AsyncStorage.setItem(PARKED_KEY, JSON.stringify(rows.filter((r) => r.id !== id)));
  return found?.lines ?? [];
}
