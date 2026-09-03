/**
 * Stocks data hook
 * 
 * Purpose : Fetching, caching and refreshing stock data.
 * Spec    : Section 6
 * Look here when : Stock data is stale after a change.
 */

import { useAsync } from './useAsync';
import { getAdjustments, getSeasonalWarnings, getStockItem, getSummary, listStocks } from '../api/stocks';

export function useStocks() {
  return useAsync(() => listStocks(), []);
}

export function useStockSummary() {
  return useAsync(() => getSummary(), []);
}

export function useSeasonalWarnings() {
  return useAsync(() => getSeasonalWarnings(), []);
}

export function useStockItem(id: string) {
  return useAsync(() => getStockItem(id), [id]);
}

export function useAdjustments(stockItemId: string) {
  return useAsync(() => getAdjustments(stockItemId), [stockItemId]);
}
