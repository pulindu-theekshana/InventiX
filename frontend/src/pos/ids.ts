/**
 * Till ids
 *
 * Purpose : The one id a bill carries from the moment it is made, so a resend is recognised as the same bill rather than a second one.
 * Spec    : Section 6.6
 * Look here when : A bill is stored twice, or an id is rejected as not a uuid.
 */

/** crypto.randomUUID is not in every runtime this app meets, so a fallback is kept. */
export function newId(): string {
  const maybe = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybe?.randomUUID) return maybe.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
