/**
 * Connection check
 *
 * Purpose : Whether the device knows it has no connection. One answer, so screens do not each invent their own.
 * Spec    : Section 6.6
 * Look here when : A screen says "offline" when it is not, or the other way round.
 */

/**
 * Only ever trust a `false`.
 *
 * `navigator.onLine === true` means "a network adapter is attached", not "the internet works" --
 * a laptop on a WiFi with a dead router says true all day. `false` is reliable, and it is the only
 * thing this is used to decide: whether to warn before an action that cannot be undone offline.
 *
 * Deliberately not `@react-native-community/netinfo`: that is a dependency for one boolean, and on
 * native the screens that ask this question are web screens anyway.
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
