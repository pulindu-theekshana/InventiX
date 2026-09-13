/**
 * Notification list
 * 
 * Purpose : Past alerts, newest first, with unread ones marked. Tapping opens the screen the notification is about, using the same routing push handling will use.
 * Spec    : Section 13
 * Look here when : A notification opens the wrong screen.
 */

import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../src/components/ui/Card';
import { EmptyState } from '../src/components/EmptyState';
import { ErrorBanner } from '../src/components/ErrorBanner';
import { colors } from '../src/theme/colors';
import { radius, spacing } from '../src/theme/spacing';
import { text } from '../src/theme/typography';
import { relative } from '../src/lib/format';
import { routeFor, useNotifications } from '../src/hooks/useNotifications';
import { useAuth } from '../src/hooks/useAuth';
import { markRead } from '../src/api/notifications';

/** Every type backend/app/feeds and backend/app/jobs can send. Spec 13. */
const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  low_stock: 'trending-down',
  supplier_delivered: 'cube',
  order_rejected: 'close-circle',
  order_cancelled: 'close-circle',
  order_confirmed: 'checkmark-circle',
  order_auto_confirmed: 'checkmark-circle',
  order_completed: 'checkmark-done-circle',
  order_ageing: 'hourglass',
  order_unanswered: 'help-circle',
  auto_confirm_warning: 'alert-circle',
  stage_change: 'swap-horizontal',
  seasonal: 'sparkles',
  stale_stock: 'time',
};

const TINT: Record<string, string> = {
  low_stock: colors.warning,
  supplier_delivered: colors.info,
  order_rejected: colors.danger,
  order_cancelled: colors.danger,
  order_confirmed: colors.success,
  order_auto_confirmed: colors.success,
  order_completed: colors.success,
  order_ageing: colors.warning,
  order_unanswered: colors.warning,
  auto_confirm_warning: colors.warning,
  stage_change: colors.info,
  seasonal: colors.accent,
  stale_stock: colors.textSubtle,
};

export default function Notifications() {
  const notifications = useNotifications();
  const { role } = useAuth();
  const list = notifications.data ?? [];

  /**
   * Marking read must never stop the tap from opening the screen: the notification is a way in,
   * and failing to record that it was read is not worth blocking the user for.
   */
  async function open(n: (typeof list)[number]) {
    try {
      await markRead(n.id);
      notifications.refresh();
    } catch {
      /* the unread dot stays; the screen still opens */
    }
    router.push(routeFor(n, role) as never);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={notifications.refreshing} onRefresh={notifications.refresh} />
      }
    >
      <ErrorBanner message={notifications.error} />

      {list.length === 0 && !notifications.loading ? (
        <EmptyState
          icon="notifications-outline"
          title="No alerts yet"
          message="Low stock warnings, order updates and festival reminders arrive here."
        />
      ) : (
        list.map((n) => (
          <Card
            key={n.id}
            style={[styles.card, n.read_at === null && styles.unread]}
            onPress={() => open(n)}
          >
            <View style={[styles.iconRing, { backgroundColor: (TINT[n.type] ?? colors.accent) + '22' }]}>
              <Ionicons
                name={ICON[n.type] ?? 'notifications'}
                size={18}
                color={TINT[n.type] ?? colors.accent}
              />
            </View>
            <View style={styles.body}>
              <Text style={text.bodyStrong}>{n.title}</Text>
              <Text style={[text.caption, styles.muted]}>{n.body}</Text>
              <Text style={[text.caption, styles.time]}>{relative(n.created_at)}</Text>
            </View>
            {n.read_at === null ? <View style={styles.dot} /> : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg },
  card: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, borderRadius: radius.md },
  unread: { backgroundColor: colors.primaryTint },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  time: { color: colors.textSubtle, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginTop: spacing.xs },
});
