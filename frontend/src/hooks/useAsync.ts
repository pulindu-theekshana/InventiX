/**
 * Async data helper
 * 
 * Purpose : The fetch, loading, error and refresh cycle that every data hook in this folder needs. Written once here so the five hooks below it are three lines each instead of fifteen.
 * Spec    : -
 * Look here when : A screen never leaves its loading state, or an error never clears on retry.
 * 
 * NOTE: not in docs/02-file-structure.md. Added because useStocks, useOrders, useSuppliers,
 * useNotifications and useRealtime were otherwise five copies of the same block.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toMessage } from '../lib/errors';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Distinguishes pull-to-refresh from the first load, so the list is not replaced by a spinner. */
  refreshing: boolean;
}

export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Guards against setting state after the screen has gone. */
  const alive = useRef(true);

  const run = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const result = await fetcher();
        if (alive.current) setData(result);
      } catch (e) {
        if (alive.current) setError(toMessage(e));
      } finally {
        if (alive.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    run(false);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refreshing, refresh: () => run(true) };
}
