/**
 * Supplier order detail
 * 
 * Purpose : Everything about one order, plus Confirm and Reject. Rejecting requires a reason, which is stored and shown to the customer. A supplier can never mark an order purchased: only the customer completes it, so stock never rises on an unverified claim.
 * Spec    : Section 10.2
 * Look here when : Confirm or Reject misbehaves.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { Modal } from '../../../src/components/ui/Modal';
import { StageProgress } from '../../../src/components/StageProgress';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { fontFamily, fontSize, text } from '../../../src/theme/typography';
import { currency, date, quantity } from '../../../src/lib/format';
import { STAGE } from '../../../src/constants/stages';
import { useSupplierOrder } from '../../../src/hooks/useOrders';
import { confirmOrder, rejectOrder } from '../../../src/api/orders';

export default function SupplierOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useSupplierOrder(id);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const o = order.data;
  if (order.loading) return <View style={styles.root} />;
  if (!o) return <ErrorBanner message="That order could not be found." />;

  const isPending = o.status === 'requested';

  async function confirm() {
    setBusy(true);
    await confirmOrder(id);
    setBusy(false);
    order.refresh();
    router.push('/(supplier)/delivery');
  }

  async function reject() {
    setBusy(true);
    await rejectOrder(id, reason.trim());
    setBusy(false);
    setRejecting(false);
    order.refresh();
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.gap}>
          <View style={styles.headRow}>
            <View style={styles.flex}>
              <Text style={text.h2}>{o.reference}</Text>
              <Text style={[text.label, styles.muted]}>{o.counterparty_name}</Text>
            </View>
            <Badge label={STAGE[o.status].label} tone={isPending ? 'warning' : 'info'} />
          </View>
          {!isPending ? <StageProgress status={o.status} /> : null}
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>What they want</Text>
          {o.items.map((i) => (
            <View key={i.catalog_product_id} style={styles.item}>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{i.name}</Text>
                <Text style={[text.caption, styles.muted]}>{i.pack_size}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={text.bodyStrong}>{quantity(i.quantity_requested)}</Text>
                <Text style={[text.caption, styles.muted]}>{currency(i.unit_price_at_order)} each</Text>
              </View>
            </View>
          ))}
          <View style={styles.total}>
            <Text style={text.label}>Order value</Text>
            <Text style={text.bodyStrong}>{currency(o.total_value)}</Text>
          </View>
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>Deliver to</Text>
          <Line icon="business-outline" value={o.counterparty_name} />
          <Line icon="location-outline" value={o.counterparty_address ?? '—'} />
          <Line icon="call-outline" value={o.counterparty_phone ?? '—'} />
          <Line
            icon="calendar-outline"
            value={'Wanted by ' + date(o.requested_delivery_date)}
          />
        </Card>

        <Card style={styles.gap}>
          <Text style={text.title}>Their message</Text>
          <Text style={[text.caption, styles.message]}>{o.message_body}</Text>
        </Card>

        {o.rating ? (
          <Card style={styles.gap}>
            <Text style={text.title}>Their rating</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= o.rating!.quality_score ? 'star' : 'star-outline'}
                  size={18}
                  color={colors.warning}
                />
              ))}
            </View>
            {o.rating.comment ? (
              <Text style={[text.label, styles.muted]}>{o.rating.comment}</Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {isPending ? (
        <View style={styles.actions}>
          <Text style={[text.caption, styles.actionNote]}>
            Confirming reserves this quantity from your listings.
          </Text>
          <View style={styles.actionRow}>
            <Button
              label="Reject"
              variant="outline"
              loading={busy}
              onPress={() => setRejecting(true)}
              style={styles.flex}
            />
            <Button
              label="Confirm"
              variant="send"
              icon="checkmark"
              loading={busy}
              onPress={confirm}
              style={styles.flex}
            />
          </View>
        </View>
      ) : null}

      {/* Spec 10.2 — a reason is required, stored on the order, and shown to the customer. */}
      <Modal
        visible={rejecting}
        onClose={() => setRejecting(false)}
        variant="dialog"
        title="Why are you rejecting this?"
        footer={
          <View style={styles.actionRow}>
            <Button label="Back" variant="outline" onPress={() => setRejecting(false)} style={styles.flex} />
            <Button
              label="Reject order"
              variant="danger"
              disabled={reason.trim().length < 3}
              loading={busy}
              onPress={reject}
              style={styles.flex}
            />
          </View>
        }
      >
        <Text style={[text.label, styles.muted]}>
          The customer sees this, and their products return to Low stock so they can order
          elsewhere. A vague reason wastes their time.
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Out of stock until the middle of next month"
          placeholderTextColor={colors.textSubtle}
          multiline
          style={styles.reason}
        />
      </Modal>
    </View>
  );
}

function Line({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.line}>
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
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  message: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    lineHeight: 18,
  },
  stars: { flexDirection: 'row', gap: spacing.xs },
  actions: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.surface },
  actionNote: { color: colors.textSubtle, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
  },
});
