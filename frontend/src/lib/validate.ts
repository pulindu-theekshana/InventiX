/**
 * Field validation
 * 
 * Purpose : The rules behind every date, time and email field, as plain sentences the user can act on. One place, so the same address is judged the same way on login, registration and profile setup.
 * Spec    : -
 * Look here when : A field accepts something it should reject, or an error sentence reads wrong.
 */

/** Shown under a field the user left empty. Matches the wording in the design. */
export const REQUIRED = 'This is a required question.';

interface Options {
  /** An empty value is an error. Optional fields stay silent while empty. */
  required?: boolean;
}

/* ------------------------------------------------------------------ email */

/**
 * Characters the local part may contain — letters, numbers, dot, underscore,
 * hyphen, plus. Deliberately narrower than RFC 5322, which permits quoted
 * strings almost nobody types and no Sri Lankan mail provider issues.
 */
const LOCAL_ALLOWED = /^[A-Za-z0-9._+-]+$/;

/** A dotted domain ending in a 2+ letter extension: gmail.com, sltnet.lk, co.uk. */
const DOMAIN = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/**
 * Every rule the address breaks, worst structure first. An empty array means valid.
 *
 * Returns all failures rather than the first, because a half-typed address usually
 * breaks two rules at once and fixing them one round trip at a time is the thing
 * users complain about.
 */
export function emailErrors(value: string, opts: Options = {}): string[] {
  const v = (value ?? '').trim();
  if (v.length === 0) return opts.required ? [REQUIRED] : [];

  const out: string[] = [];

  if (/\s/.test(value ?? '')) out.push('Spaces are not allowed.');
  if (v.length > 254) out.push('Keep the address under 254 characters.');

  /* The @ count decides whether the rest can be judged at all, so it comes first
     and, when wrong, ends the check — "the part before @" means nothing yet. */
  const atCount = v.split('@').length - 1;
  if (atCount !== 1) {
    out.push('Must contain exactly one @ symbol.');
    return out;
  }

  const [local, domain] = v.split('@');

  if (local.length === 0) {
    out.push('Add the name before the @.');
  } else {
    if (local.startsWith('.') || local.endsWith('.')) {
      out.push('The part before @ cannot start or end with a dot.');
    }
    /* Whitespace is stripped before this test so a typed space is reported once,
       by the rule above, instead of twice. */
    if (!LOCAL_ALLOWED.test(local.replace(/\s/g, ''))) {
      out.push('Before @, use only letters, numbers and . _ - +');
    }
  }

  if (v.includes('..')) out.push('Two dots in a row are not allowed.');

  if (domain.length === 0) {
    out.push('Add a domain after @, like gmail.com');
  } else if (!DOMAIN.test(domain)) {
    out.push('The domain needs a dot and an ending of 2 or more letters, like .com or .lk');
  }

  return out;
}

export function isValidEmail(value: string): boolean {
  return emailErrors(value, { required: true }).length === 0;
}

/* ------------------------------------------------------------------- date */

/** Length of the given month, leap years included. Month is 1-12. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Every rule a YYYY-MM-DD date breaks. An empty array means valid. */
export function dateErrors(value: string, opts: Options = {}): string[] {
  const v = (value ?? '').trim();
  if (v.length === 0) return opts.required ? [REQUIRED] : [];

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!parts) return ['Use the format YYYY-MM-DD, like 2026-09-18.'];

  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const out: string[] = [];

  if (year < 1900 || year > 2999) out.push('Year must be between 1900 and 2999.');

  if (month < 1 || month > 12) {
    out.push('Month must be between 01 and 12.');
    /* Without a real month there is no last day to compare against, so the day
       rule is skipped rather than guessed. */
  } else {
    const last = daysInMonth(year, month);
    if (day < 1 || day > last) out.push(`Day must be between 01 and ${last} for that month.`);
  }

  return out;
}

export function isValidDate(value: string): boolean {
  return dateErrors(value, { required: true }).length === 0;
}

/* ------------------------------------------------------------------- time */

/** Every rule an HH:MM time breaks. An empty array means valid. */
export function timeErrors(value: string, opts: Options = {}): string[] {
  const v = (value ?? '').trim();
  if (v.length === 0) return opts.required ? [REQUIRED] : [];

  const parts = /^(\d{2}):(\d{2})$/.exec(v);
  if (!parts) return ['Use the format HH:MM, like 14:30.'];

  const out: string[] = [];
  if (Number(parts[1]) > 23) out.push('Hours must be between 00 and 23.');
  if (Number(parts[2]) > 59) out.push('Minutes must be between 00 and 59.');
  return out;
}

export function isValidTime(value: string): boolean {
  return timeErrors(value, { required: true }).length === 0;
}

/* ------------------------------------------------------------------ masks */

/**
 * Digits in, YYYY-MM-DD out. Everything that is not a digit is dropped, which is
 * what keeps letters out of the field when a hardware keyboard or a paste gets
 * past the numeric keypad.
 */
export function maskDate(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

/** Digits in, HH:MM out. Same reasoning as `maskDate`. */
export function maskTime(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/* --------------------------------------------------------------- password */

/** Spec: a password must be at least this long. The one place the number lives. */
export const MIN_PASSWORD = 8;

/**
 * Every rule a password breaks. An empty array means valid.
 *
 * Length is the only rule. Nothing here asks for a capital, a digit or a symbol:
 * those push people towards one predictable substitution each and make a password
 * harder to remember without making it harder to guess.
 */
export function passwordErrors(value: string, opts: Options = {}): string[] {
  const v = value ?? '';
  if (v.length === 0) return opts.required ? [REQUIRED] : [];

  const out: string[] = [];
  if (v.length < MIN_PASSWORD) out.push(`Use at least ${MIN_PASSWORD} characters.`);
  return out;
}

export function isValidPassword(value: string): boolean {
  return passwordErrors(value, { required: true }).length === 0;
}
