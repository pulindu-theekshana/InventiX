/**
 * Customer order detail
 * 
 * Purpose : Every product and quantity, the message that was sent, the full stage history, and whichever action spec 8.3 allows at this status. Confirm receipt lives here, and it is the only action that tops up stock.
 * Spec    : Section 8.2 and 8.3
 * Look here when : An action button is missing or does the wrong thing.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { StageProgress } from '../../../src/components/StageProgress';
import { RatingPrompt } from '../../../src/components/RatingPrompt';
import { ConfirmReceiptPrompt } from '../../../src/components/ConfirmReceiptPrompt';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, date, quantity } from '../../../src/lib/format';
import { STAGE } from '../../../src/constants/stages';
import { useCustomerOrder } from '../../../src/hooks/useOrders';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { advanceStage, cancelOrder, confirmReceipt } from '../../../src/api/delivery';
import { PIPELINE } from '../../../src/types/orderStatus';

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useCustomerOrder(id);
  const submit = useSubmit();
  const [rating, setRating] = useState(false);
  const [dismissed, setDismissed] = useState(0);
  /** Confirm receipt tops up stock and cannot be undone, so it is asked about first. */
  const [confirming, setConfirming] = useState(false);

  const o = order.data;
  if (order.loading) return <View style={styles.root} />;
  if (!o) return <ErrorBanner message="That order could not be found." />;

  /** Spec 8.3 — availability of each action is decided by status, and re-checked server side. */
  const canConfirm = o.status === 'on_the_way';
  const canCancel = o.status === 'requested' || o.status === 'confirmed';
  const canReorder = o.status === 'rejected' || o.status === 'cancelled';
  /** Only for WhatsApp and email orders, where the supplier updates outside the app. */
  const canAdvance = o.channel !== 'in_app' && PIPELINE.indexOf(o.status) < PIPELINE.length - 1;

  async function act(fn: () => Promise<void>, thenRate = false) {
    // A refused stage change must say so, not leave the button spinning.
    const ok = await submit.run(fn);
    if (!ok) return;
    order.refresh();
    if (thenRate) setRating(true);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ErrorBanner message={submit.error} />
        <Card style={styles.gap}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <Text style={text.h2}>
                {o.reference}
                {o.product_summary ? ' · ' + o.product_summary : ''}
              </Text>
              <Text style={[text.label, styles.muted]}>{o.counterparty_name}</Text>
            </View>
            <Badge label={STAGE[o.status].label} tone={o.status === 'rejected' ? 'danger' : 'info'} />
          </View>
          <StageProgress status={o.status} />
        </Card>

        {o.rejection_reason ? (
          <ErrorBanner message={'Rejected: ' + o.rejection_reason} />
        ) : null}

        <Card style={styles.gap}>
          <Text style={text.title}>Products</Text>
          {o.items.map((i) => (
            <View key={i.catalog_product_id} style={styles.item}>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{i.name}</Text>
                <Text style={[text.caption, styles.muted]}>{i.pack_size}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={text.bodyStrong}>{quantity(i.quantity_requested)}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {currency(i.unit_price_at_order)} each
                </Text>
              </View>
            </View>
          ))}
          <View style={styles.total}>
            <Text style={text.label}>Total</Text>
            <Text style={text.bodyStrong}>{currency(o.total_value)}</Text>
          </View>
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>Stage history</Text>
          {o.stage_history.map((s) => (
            <View key={s.status} style={styles.stage}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[text.label, styles.flex]}>{STAGE[s.status].label}</Text>
              <Text style={[text.caption, styles.muted]}>{date(s.at)}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>Message sent</Text>
          <Text style={[text.caption, styles.message]}>{o.message_body}</Text>
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>Supplier</Text>
          <Row icon="call-outline" value={o.counterparty_phone ?? '—'} />
          <Row icon="location-outline" value={o.counterparty_address ?? '—'} />
        </Card>
      </ScrollView>

      <View style={styles.actions}>
        {canConfirm ? (
          <Button
            label="Confirm receipt"
            variant="send"
            icon="checkmark-circle-outline"
            loading={submit.busy}
            onPress={() => setConfirming(true)}
            fullWidth
          />
        ) : null}
        {canAdvance ? (
          <Button
            label={'Move to ' + STAGE[PIPELINE[PIPELINE.indexOf(o.status) + 1]].label}
            variant="accent"
            icon="arrow-forward"
            loading={submit.busy}
            onPress={() => act(() => advanceStage(id, PIPELINE[PIPELINE.indexOf(o.status) + 1]))}
            fullWidth
          />
        ) : null}
        {canCancel ? (
          <Button
            label="Cancel order"
            variant="outline"
            loading={submit.busy}
            onPress={() => act(() => cancelOrder(id))}
            fullWidth
          />
        ) : null}
        {canReorder ? (
          <Button
            label="Re-order from someone else"
            variant="accent"
            icon="swap-horizontal"
            onPress={() => router.push('/(customer)/stocks')}
            fullWidth
          />
        ) : null}
      </View>

      {/* Asked before the only action that tops up stock, because it cannot be undone. */}
      <ConfirmReceiptPrompt
        visible={confirming}
        supplierName={o.counterparty_name}
        units={o.total_quantity}
        busy={submit.busy}
        onConfirm={async () => {
          setConfirming(false);
          await act(() => confirmReceipt(id), true);
        }}
        onCancel={() => setConfirming(false)}
      />

      {/* Spec 12.3 — prompted immediately after confirming receipt, skippable, shown twice. */}
      <RatingPrompt
        visible={rating}
        supplierName={o.counterparty_name}
        timesDismissed={dismissed}
        onSubmit={() => setRating(false)}
        onDismiss={() => {
          setRating(false);
          setDismissed((d) => d + 1);
        }}
      />
    </View>
  );
}

function Row({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.stage}>
      <Ionicons name={icon} size={16} color={colors.textSubtle} />
      <Text style={[text.label, styles.flex]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemRight: { alignItems: 'flex-end' },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  stage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    lineHeight: 18,
  },
  actions: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface },
});
