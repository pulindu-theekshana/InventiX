/**
 * New version prompt
 *
 * Purpose : Tells the person a newer build is waiting and lets them take it when they are ready. Web only, and only when the till is installed or served as a built app.
 * Spec    : Section 6.6
 * Look here when : A deploy does not reach the shop, or the app reloads itself at a bad moment.
 */

import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

/**
 * A service worker caches well enough that a shop can run last week's build for days. The usual
 * fix is to let the new one take over the moment it arrives -- which, at a till, means the screen
 * reloading while a customer is mid-bill. So the choice is the cashier's: the bar waits, and the
 * queued sales on the device survive the reload either way.
 */
export function UpdateReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const show = () => setReady(true);
    window.addEventListener('inventix:update-ready', show);
    return () => window.removeEventListener('inventix:update-ready', show);
  }, []);

  if (!ready) return null;

  function take() {
    const registration = (window as unknown as { __inventixUpdate?: ServiceWorkerRegistration })
      .__inventixUpdate;
    registration?.waiting?.postMessage('SKIP_WAITING');
    // The worker takes over, then the page is reloaded onto it. Reloading first would just load
    // the old cached build again.
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
    // A worker that never answers must not leave the bar stuck on screen for ever.
    setTimeout(() => window.location.reload(), 2000);
  }

  return (
    <View style={styles.bar}>
      <Ionicons name="arrow-down-circle-outline" size={18} color={colors.brandInk} />
      <Text style={[text.label, styles.flex]}>A newer version of the till is ready.</Text>
      <Pressable onPress={take} style={styles.action}>
        <Text style={[text.bodyStrong, { color: colors.brandInk }]}>Reload now</Text>
      </Pressable>
      <Pressable onPress={() => setReady(false)} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.brandInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1 },
});
