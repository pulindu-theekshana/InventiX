/**
 * Submit helper
 *
 * Purpose : Runs one write action and keeps the busy flag and the error message in step. Screens used to do this by hand, and a refused write left the button spinning for ever with the error only in the console.
 * Spec    : Section 3.1
 * Look here when : A save button never stops loading, or a backend refusal never reaches the screen.
 */

import { useRef, useState } from 'react';
import { toMessage } from '../lib/errors';

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * A ref, not the busy flag: state updates land after the current tick, so two taps in
   * quick succession both read busy as false and both run. That is how tapping a slow
   * restock button repeatedly ended up opening several request screens at once.
   */
  const running = useRef(false);

  /**
   * Returns true only when the action succeeded, so a caller can navigate away or clear a
   * field on success without repeating the try/catch. `finally` is what guarantees the
   * button is released whichever way the action ends.
   */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(toMessage(e));
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return { busy, error, run };
}
