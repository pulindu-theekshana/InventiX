/**
 * Formatting helpers
 * 
 * Purpose : LKR currency, dates, and quantities. One place so numbers look the same everywhere.
 * Spec    : -
 * Look here when : A price or date renders differently on two screens.
 */

/** LKR 1,250.00 — the form used throughout the Figma. */
export function currency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `LKR ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** LKR 1,250 — no decimals, for totals in dense lists. */
export function currencyShort(value: number | null | undefined): string {
  if (value == null) return '—';
  return `LKR ${Math.round(value).toLocaleString('en-LK')}`;
}

/** 16 May 2026 */
export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 16 May, for cards where the year is obvious. */
export function dateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/** "3 days ago", "in 2 weeks". Used for order ageing and seasonal countdowns. */
export function relative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  const abs = Math.abs(days);
  if (abs === 0) return 'today';
  const unit = abs < 14 ? { n: abs, w: abs === 1 ? 'day' : 'days' } : { n: Math.round(abs / 7), w: Math.round(abs / 7) === 1 ? 'week' : 'weeks' };
  return days < 0 ? `${unit.n} ${unit.w} ago` : `in ${unit.n} ${unit.w}`;
}

/** 1,250 */
export function quantity(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-LK');
}

/** 4.3 — one decimal, for star ratings. */
export function rating(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(1);
}

/** LT, TS, GS — the two-letter avatar in the supplier list. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
