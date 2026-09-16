/**
 * useFieldErrors
 * 
 * Purpose : Decides when a field is allowed to complain. Rules are checked on every keystroke but stay hidden until the user leaves the field, or the form is submitted, so nobody is told their email is wrong while they are still typing the first letter.
 * Spec    : -
 * Look here when : A field turns red too early, or stays grey after a failed submit.
 */

import { useState } from 'react';

interface Options {
  /**
   * Reveal the errors without waiting for a blur. Set this from a failed submit so
   * every bad field lights up at once instead of one per tap.
   */
  showErrors?: boolean;
}

export function useFieldErrors(
  value: string,
  validate: (value: string) => string[],
  { showErrors = false }: Options = {},
) {
  const [touched, setTouched] = useState(false);
  const errors = validate(value);

  return {
    /** Every broken rule, whether or not it is being shown. Use this to gate a submit. */
    errors,
    /** The rules the user should see right now. */
    visible: touched || showErrors ? errors : [],
    /** Hand this to the field's onBlur. */
    markTouched: () => setTouched(true),
  };
}
