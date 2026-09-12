/**
 * Realtime subscriptions
 * 
 * Purpose : Subscribes to Supabase realtime so a stage change appears without a refresh.
 * Spec    : Section 3.1
 * Look here when : A live update does not arrive.
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Spec 3.1 allows the app to read Supabase directly and subscribe to realtime, because row
 * level security makes it safe. Writes still go through FastAPI. This hook therefore only
 * ever triggers a refetch; it never applies a change itself.
 */
export function useRealtime(
  table: 'orders' | 'stock_items' | 'notifications' | 'supplier_listings',
  filter: string | null,
  onChange: () => void,
) {
  /**
   * One channel name per hook call. Three screens subscribe to `orders`, and two of them are
   * alive at once while a screen transition finishes -- sharing a name makes the second one
   * attach to a channel that has already been subscribed, which realtime refuses.
   */
  const id = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('realtime:' + table + (filter ? ':' + filter : '') + ':' + id.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        () => onChange(),
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);
}
