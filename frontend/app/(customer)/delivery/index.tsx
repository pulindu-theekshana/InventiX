/**
 * Customer delivery feed
 * 
 * Purpose : Two sections, as spec 8.1 defines them: Requested is waiting on the supplier, Confirmed is everything accepted. Rejected and cancelled are not here; they live in the history screen so recent failures stay visible without cluttering active work.
 * Spec    : Section 8.1
 * Look here when : An order appears in the wrong section.
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OrderCard } from '../../../src/components/OrderCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useCustomerOrders } from '../../../src/hooks/useOrders';
import { useRealtime } from '../../../src/hooks/useRealtime';
import { CUSTOMER_CONFIRMED, CUSTOMER_REQUESTED } from '../../../src/types/orderStatus';

type Tab = 'requested' | 'confirmed';

export default function DeliveryFeed() {
  const orders = useCustomerOrders();
  const [tab, setTab] = useState<Tab>('requested');

  /** Spec 3.1 — realtime only triggers a refetch; the app never applies a change itself. */
  useRealtime('orders', null, orders.refresh);

  const all = orders.data ?? [];
  const requested = useMemo(() => all.filter((o) => CUSTOMER_REQUESTED.includes(o.status)), [all]);
  const confirmed = useMemo(() => all.filter((o) => CUSTOMER_CONFIRMED.includes(o.status)), [all]);
  const shown = tab === 'requested' ? requested : confirmed;

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Tab2 label="Requested" count={requested.length} active={tab === 'requested'} onPress={() => setTab('requested')} />
        <Tab2 label="Confirmed" count={confirmed.length} active={tab === 'confirmed'} onPress={() => setTab('confirmed')} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} />}
      >
        <ErrorBanner message={orders.error} />

        {shown.length === 0 ? (
          <EmptyState
            icon={tab === 'requested' ? 'paper-plane-outline' : 'cube-outline'}
            title={tab === 'requested' ? 'Nothing waiting on a supplier' : 'No active deliveries'}
            message={
              tab === 'requested'
                ? 'Orders you have sent appear here until the supplier accepts or declines them.'
                : 'Once a supplier accepts an order it moves here, and you can follow it through each stage.'
            }
          />
        ) : (
          shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              showProgress={tab === 'confirmed'}
              onPress={() => router.push(`/(customer)/delivery/${o.id}`)}
            />
          ))
        )}

        <Pressable style={styles.historyLink} onPress={() => router.push('/(customer)/delivery/history')}>
          <Ionicons name="archive-outline" size={18} color={colors.accent} />
          <Text style={[text.label, { color: colors.accent }]}>
            Past orders
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Tab2({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[text.bodyStrong, { color: active ? colors.accent : colors.textMuted }]}>
        {label}
      </Text>
      <View style={[styles.pill, active && { backgroundColor: colors.accent }]}>
        <Text style={[text.caption, { color: active ? colors.onAccent : colors.textMuted }]}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  pill: {
    minWidth: 22,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  scroll: { padding: spacing.lg },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
});
