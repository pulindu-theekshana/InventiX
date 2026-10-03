/**
 * Which build is running
 *
 * Purpose : The stamp the export writes into the page, so a shop can say which version it has rather than everyone guessing whether a fix arrived.
 * Spec    : Section 6.6
 * Look here when : A fix does not seem to have reached the till.
 */

/**
 * Written by scripts/stamp-sw.mjs at export time, and the same string as the service worker's
 * cache name. Empty on the development server and on native, where there is no built page to
 * stamp -- and "dev" is the honest answer there.
 */
export function buildStamp(): string {
  if (typeof document === 'undefined') return 'dev';
  const meta = document.querySelector('meta[name="inventix-build"]');
  const value = meta?.getAttribute('content') ?? '';
  return !value || value.includes('__BUILD__') ? 'dev' : value;
}
