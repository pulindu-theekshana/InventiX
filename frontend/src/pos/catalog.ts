/**
 * Till catalog
 *
 * Purpose : The products the till searches, kept on the device so a counter with no connection can still build a bill.
 * Spec    : Section 6.6
 * Look here when : The till finds no products, or sells at a price the shop has since changed.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listStocks } from '../api/stocks';
import type { StockItemView } from '../types/api';

const KEY = 'pos.catalog';
const AT_KEY = 'pos.catalog.at';

let cache: StockItemView[] | null = null;
let updatedAt: string | null = null;
const listeners = new Set<() => void>();

function announce() {
  listeners.forEach((l) => l());
}

/**
 * What the till knows right now. Empty until load() has run once.
 *
 * Quantities here are a snapshot and will be out of date on a till that has been offline -- which
 * is fine, because a sale is a record, not a request: the backend clamps the stock movement when
 * the bill arrives (domain/pos.stock_movement). Prices are the shop's own and change rarely.
 */
export function current(): StockItemView[] {
  return cache ?? [];
}

export function lastUpdated(): string | null {
  return updatedAt;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reads what the device already has, then asks the backend for anything newer. */
export async function load(): Promise<StockItemView[]> {
  if (!cache) {
    try {
      cache = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null') as StockItemView[] | null;
      updatedAt = await AsyncStorage.getItem(AT_KEY);
    } catch {
      cache = null;
    }
  }
  void refresh();
  return cache ?? [];
}

/** Returns null when the backend could not be reached, leaving the stored copy in force. */
export async function refresh(): Promise<StockItemView[] | null> {
  try {
    const fresh = await listStocks();
    cache = fresh;
    updatedAt = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(fresh));
    await AsyncStorage.setItem(AT_KEY, updatedAt);
    announce();
    return fresh;
  } catch {
    // Offline, or the backend is down. The till keeps selling from what it has.
    announce();
    return null;
  }
}

export async function clear(): Promise<void> {
  cache = null;
  updatedAt = null;
  await AsyncStorage.multiRemove([KEY, AT_KEY]);
  announce();
}

/**
 * What a till screen needs: the products, whether they are a stored copy, and a way to ask again.
 * Deliberately not useStocks(): that one fetches on mount and has nothing to show when the fetch
 * fails, which at a counter means an empty shop.
 */
export function useTillCatalog() {
  const [items, setItems] = useState<StockItemView[]>(current());
  const [at, setAt] = useState<string | null>(lastUpdated());
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    load().then((rows) => {
      if (alive) setItems(rows);
    });
    const stop = subscribe(() => {
      setItems(current());
      setAt(lastUpdated());
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const ask = useCallback(async () => {
    const fresh = await refresh();
    setStale(fresh === null);
  }, []);

  return {
    items,
    /** True when the last attempt failed, so the screen can say the list is a stored one. */
    stale,
    updatedAt: at,
    refresh: ask,
  };
}
