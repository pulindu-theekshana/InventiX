/**
 * Supplier delivery queue
 * 
 * Purpose : Orders in flight, grouped by stage, with the advance button on the card itself so a supplier moving twenty orders does not need several taps each. Orders leave the moment they are complete, and stay permanently in the Orders feed.
 * Spec    : Section 10.3
 * Look here when : A stage advance does not work from the card.
 */

import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OrderCard } from '../../../src/components/OrderCard';
import { Button } from '../../../src/components/ui/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { STAGE, SUPPLIER_ADVANCE } from '../../../src/constants/stages';
import { useSupplierOrders } from '../../../src/hooks/useOrders';
import { useRealtime } from '../../../src/hooks/useRealtime';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { SUPPLIER_QUEUE, type OrderStatus } from '../../../src/types/orderStatus';
import { advanceStage, markDelivered } from '../../../src/api/orders';

export default function SupplierDelivery() {
  const orders = useSupplierOrders();
  const [busyId, setBusyId] = useState<string | null>(null);
  const submit = useSubmit();

  useRealtime('orders', null, orders.refresh);

  const groups = useMemo(() => {
    const inFlight = (orders.data ?? []).filter((o) => SUPPLIER_QUEUE.includes(o.status));
    return SUPPLIER_QUEUE.map((stage) => ({
      stage,
      /** Most urgent first: sorted by the date the customer asked for. */
      items: inFlight
        .filter((o) => o.status === stage)
        .sort((a, b) =>
          (a.requested_delivery_date ?? '').localeCompare(b.requested_delivery_date ?? ''),
        ),
    })).filter((g) => g.items.length > 0);
  }, [orders.data]);

  async function advance(id: string, status: OrderStatus) {
    const step = SUPPLIER_ADVANCE[status];
    if (!step) return;
    setBusyId(id);
    /**
     * Spec 11.3 — on_the_way has no next status. Marking delivered records a timestamp and
     * notifies the customer; only the customer can complete the order.
     *
     * Through useSubmit so a failed request shows its reason and releases the button.
     * Awaited bare, a dropped connection left the spinner running for ever.
     */
    const ok = await submit.run(() => (step.next ? advanceStage(id, step.next) : markDelivered(id)));
    setBusyId(null);
    if (ok) orders.refresh();
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} />}
    >
      <ErrorBanner message={orders.error} />
      <ErrorBanner message={submit.error} />

      {groups.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="Nothing in flight"
          message="Orders you have confirmed appear here until the customer confirms receipt. Accept an order from the Orders feed to start."
          actionLabel="Go to Orders"
          onAction={() => router.push('/(supplier)/orders')}
        />
      ) : (
        groups.map((g) => (
          <View key={g.stage} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.dot, { backgroundColor: STAGE[g.stage].color }]} />
              <Text style={text.h2}>{STAGE[g.stage].label}</Text>
              <Text style={[text.label, styles.count]}>{g.items.length}</Text>
            </View>

            {g.items.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                showProgress={false}
                onPress={() => router.push(`/(supplier)/orders/${o.id}`)}
                action={
                  <Button
                    label={SUPPLIER_ADVANCE[o.status]?.action ?? 'Advance'}
                    variant={o.status === 'on_the_way' ? 'send' : 'accent'}
                    size="sm"
                    icon={o.status === 'on_the_way' ? 'checkmark-done' : 'arrow-forward'}
                    loading={busyId === o.id}
                    onPress={() => advance(o.id, o.status)}
                    fullWidth
                  />
                }
              />
            ))}
          </View>
        ))
      )}

      {groups.length > 0 ? (
        <Text style={[text.caption, styles.note]}>
          Marking an order delivered tells the customer to confirm receipt. It does not complete
          the order, because their stock should only rise on a fact rather than a claim.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg },
  group: { marginBottom: spacing.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  count: { color: colors.textSubtle },
  note: { color: colors.textSubtle, marginTop: spacing.sm },
});
