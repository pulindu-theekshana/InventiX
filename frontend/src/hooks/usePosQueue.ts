/**
 * Till outbox hook
 *
 * Purpose : What a till screen needs from the outbox: how many bills are unsent, whether any are stuck, and a retry that runs by itself.
 * Spec    : Section 6.6
 * Look here when : The "waiting to sync" badge is wrong, or sales never retry on their own.
 */

import { useEffect, useState } from 'react';
import * as queue from '../pos/queue';

/**
 * Every 20 seconds while anything is waiting. No network listener: `@react-native-community/
 * netinfo` is a dependency this project does not carry, and a failed attempt costs one request.
 * The interval stops mattering the moment the queue empties, because sync() returns immediately.
 */
const RETRY_MS = 20_000;

export function usePosQueue() {
  const [waiting, setWaiting] = useState(0);
  const [stuck, setStuck] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const counts = await queue.counts();
      if (!alive) return;
      setWaiting(counts.waiting);
      setStuck(counts.stuck);
      setError(await queue.lastError());
    }

    refresh();
    const unsubscribe = queue.subscribe(refresh);
    const timer = setInterval(() => {
      // Only when there is something to send, so an idle till is not polling the backend.
      queue.counts().then(({ waiting: n }) => {
        if (n > 0) void queue.sync();
      });
    }, RETRY_MS);

    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return {
    waiting,
    stuck,
    /** Why the last attempt failed. Shown so "not sent" is not a mystery. */
    error,
    /** The owner pressing "try now", after fixing the WiFi. */
    syncNow: () => queue.sync(),
  };
}
