/**
 * Supplier orders feed
 * 
 * Purpose : The complete business record: Pending, Active and History, as spec 10.2 defines them. Pending is sorted oldest first so nobody is left waiting. An order never leaves this feed, which is why Delivery is a separate working queue rather than a stage filter.
 * Spec    : Section 10.2
 * Look here when : An order is in the wrong section or a filter fails.
 */

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OrderCard } from '../../../src/components/OrderCard';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Input } from '../../../src/components/ui/Input';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useSupplierOrders } from '../../../src/hooks/useOrders';
import { useRealtime } from '../../../src/hooks/useRealtime';
import { SUPPLIER_ACTIVE, SUPPLIER_HISTORY, SUPPLIER_PENDING } from '../../../src/types/orderStatus';

type Section = 'pending' | 'active' | 'history';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
];

export default function SupplierOrders() {
  const orders = useSupplierOrders();
  const [section, setSection] = useState<Section>('pending');
  const [query, setQuery] = useState('');

  useRealtime('orders', null, orders.refresh);

  const all = orders.data ?? [];
  const buckets = useMemo(
    () => ({
      /** Oldest first: spec 10.2 is explicit that nobody should be left waiting. */
      pending: all
        .filter((o) => SUPPLIER_PENDING.includes(o.status))
        .sort((a, b) => a.requested_at.localeCompare(b.requested_at)),
      active: all.filter((o) => SUPPLIER_ACTIVE.includes(o.status)),
      history: all.filter((o) => SUPPLIER_HISTORY.includes(o.status)),
    }),
    [all],
  );

  const q = query.trim().toLowerCase();
  const shown = buckets[section].filter(
    (o) => !q || o.counterparty_name.toLowerCase().includes(q) || o.reference.toLowerCase().includes(q),
  );

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSection(s.key)}
            style={[styles.tab, section === s.key && styles.tabActive]}
          >
            <Text
              style={[text.label, { color: section === s.key ? colors.accent : colors.textMuted }]}
            >
              {s.label}
            </Text>
            <View style={[styles.pill, section === s.key && { backgroundColor: colors.accent }]}>
              <Text
                style={[
                  text.caption,
                  { color: section === s.key ? colors.onAccent : colors.textMuted },
                ]}
              >
                {buckets[s.key].length}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Input value={query} onChangeText={setQuery} placeholder="Search customer or reference" icon="search" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} />}
      >
        <ErrorBanner message={orders.error} />
        {shown.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title={section === 'pending' ? 'No orders waiting' : 'Nothing here'}
            message={
              section === 'pending'
                ? 'New orders arrive here for you to accept or decline.'
                : 'Orders move through here as they progress.'
            }
          />
        ) : (
          shown.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              showProgress={section === 'active'}
              onPress={() => router.push(`/(supplier)/orders/${o.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
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
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
});
