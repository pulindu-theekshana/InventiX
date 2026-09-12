/**
 * Submit helper
 *
 * Purpose : Runs one write action and keeps the busy flag and the error message in step. Screens used to do this by hand, and a refused write left the button spinning for ever with the error only in the console.
 * Spec    : Section 3.1
 * Look here when : A save button never stops loading, or a backend refusal never reaches the screen.
 */

import { useState } from 'react';
import { toMessage } from '../lib/errors';

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Returns true only when the action succeeded, so a caller can navigate away or clear a
   * field on success without repeating the try/catch. `finally` is what guarantees the
   * button is released whichever way the action ends.
   */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError(toMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}
