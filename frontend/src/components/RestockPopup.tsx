/**
 * Restock popup
 * 
 * Purpose : The most important component. Message area, per-product quantities, delivery date, notes, and the Edit, Send and Change supplier buttons. Owns the edited-since-generated flag and the overwrite warning.
 * Spec    : Section 6.5
 * Look here when : Send is wrongly disabled, or changing supplier loses an edit without warning.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ErrorBanner } from './ErrorBanner';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, text } from '../theme/typography';
import { currency, rating } from '../lib/format';
import { toMessage } from '../lib/errors';
import { availableChannels } from '../constants/channels';
import { newIdempotencyKey, sendOrder } from '../api/ordering';
import * as draftStore from '../stores/restockDraftStore';
import type { Channel } from '../types/database';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSent: (orderId: string) => void;
  /** Opens the Suppliers feed in selection mode. Spec 6.5 Change supplier. */
  onChangeSupplier: () => void;
  /** The last text the backend generated, used to detect a real edit. */
  generatedMessage: string;
}

export function RestockPopup({ visible, onClose, onSent, onChangeSupplier, generatedMessage }: Props) {
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getDraft, draftStore.getDraft);
  const [editing, setEditing] = useState(false);
  const [choosingChannel, setChoosingChannel] = useState(false);
  const [confirmingSupplierChange, setConfirmingSupplierChange] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** One key per popup session, so a retry on a bad connection cannot create two orders. */
  const [idempotencyKey] = useState(newIdempotencyKey);

  const problems = useMemo(() => draftStore.validate(draft), [draft]);
  if (!draft) return null;

  const supplier = draft.supplier;
  const multi = draft.lines.length > 1;
  const total = draft.lines.reduce(
    (sum, l) => sum + l.quantity_requested * (l.unit_price ?? 0),
    0,
  );

  /**
   * Spec 6.5: silently regenerate when nothing was edited, warn first when something was.
   * The message is regenerated in full by the backend, never patched, because a different
   * supplier has different prices, availability and minimums.
   */
  function handleChangeSupplier() {
    if (draft && draft.message_edited) setConfirmingSupplierChange(true);
    else onChangeSupplier();
  }

  async function handleSend(channel: Channel) {
    if (!draft) return;
    setChoosingChannel(false);
    setSending(true);
    setSendError(null);
    try {
      const result = await sendOrder(draft, channel, idempotencyKey);
      draftStore.closeDraft();
      onSent(result.order_id);
    } catch (e) {
      setSendError(toMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Restock request"
      footer={
        <View style={styles.footer}>
          <ErrorBanner messages={problems} tone="warning" />
          <ErrorBanner messages={draft?.warnings ?? []} tone="info" />
          <ErrorBanner message={sendError} />
          <View style={styles.footerRow}>
            <Button
              label={editing ? 'Done editing' : 'Edit message'}
              variant="accent"
              icon={editing ? 'checkmark' : 'create-outline'}
              onPress={() => setEditing((v) => !v)}
              style={styles.flex}
            />
            <Button
              label="Send"
              variant="send"
              icon="send"
              iconRight
              loading={sending}
              disabled={problems.length > 0}
              onPress={() => setChoosingChannel(true)}
              style={styles.flex}
            />
          </View>
          <Button
            label="Change supplier"
            variant="outline"
            icon="swap-horizontal"
            onPress={handleChangeSupplier}
            fullWidth
          />
        </View>
      }
    >
      {supplier ? (
        <View style={styles.supplier}>
          <View style={styles.supplierText}>
            <Text style={text.bodyStrong}>{supplier.business_name}</Text>
            <View style={styles.supplierMeta}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <Text style={[text.caption, styles.muted]}>
                {supplier.average_rating === null
                  ? 'No ratings yet'
                  : rating(supplier.average_rating) + ' from ' + supplier.rating_count + ' ratings'}
              </Text>
            </View>
          </View>
          {supplier.is_new_supplier ? <Badge label="New supplier" tone="info" /> : null}
        </View>
      ) : null}

      <Text style={[text.label, styles.sectionLabel]}>Products</Text>
      {draft.lines.map((line) => {
        const overAvailable =
          line.quantity_available !== null && line.quantity_requested > line.quantity_available;
        const underMinimum =
          line.min_order_quantity !== null && line.quantity_requested < line.min_order_quantity;
        return (
          <View key={line.stock_item_id} style={styles.line}>
            <View style={styles.lineText}>
              <Text style={text.bodyStrong} numberOfLines={1}>
                {line.name}
              </Text>
              <Text style={[text.caption, styles.muted]}>
                {line.pack_size}
                {line.unit_price !== null ? ' · ' + currency(line.unit_price) : ''}
              </Text>
              {/* Spec 6.5: the supplier's availability sits under every quantity field. */}
              <Text
                style={[
                  text.caption,
                  { color: overAvailable || underMinimum ? colors.danger : colors.textSubtle },
                ]}
              >
                {line.quantity_available === null
                  ? 'Availability unknown'
                  : line.quantity_available + ' available' +
                    (line.min_order_quantity ? ', min ' + line.min_order_quantity : '')}
              </Text>
            </View>
            <TextInput
              value={String(line.quantity_requested)}
              onChangeText={(v) =>
                draftStore.setQuantity(line.stock_item_id, Number(v.replace(/[^0-9]/g, '')) || 0)
              }
              keyboardType="number-pad"
              style={[styles.qty, (overAvailable || underMinimum) && styles.qtyBad]}
              accessibilityLabel={'Quantity for ' + line.name}
            />
            {/* Spec 6.5: a remove control on each line, in multi-item mode only. */}
            {multi ? (
              <Pressable
                onPress={() => draftStore.removeLine(line.stock_item_id)}
                hitSlop={8}
                accessibilityLabel={'Remove ' + line.name}
              >
                <Ionicons name="close-circle" size={22} color={colors.textSubtle} />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {total > 0 ? (
        <View style={styles.total}>
          <Text style={text.label}>Estimated total</Text>
          <Text style={text.bodyStrong}>{currency(total)}</Text>
        </View>
      ) : null}

      <Text style={[text.label, styles.sectionLabel]}>Message</Text>
      <TextInput
        value={draft.message_body}
        onChangeText={(v) => draftStore.editMessage(v, generatedMessage)}
        editable={editing}
        multiline
        style={[styles.message, !editing && styles.messageLocked]}
      />
      {draft.message_edited ? (
        <Text style={[text.caption, { color: colors.info }]}>
          You have edited this message. Changing supplier will replace it.
        </Text>
      ) : null}

      <Text style={[text.label, styles.sectionLabel]}>Delivery date</Text>
      <TextInput
        value={draft.requested_delivery_date ?? ''}
        onChangeText={(v) => draftStore.setField('requested_delivery_date', v)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textSubtle}
        style={styles.field}
      />

      <Text style={[text.label, styles.sectionLabel]}>Notes</Text>
      <TextInput
        value={draft.notes}
        onChangeText={(v) => draftStore.setField('notes', v)}
        placeholder="Anything else the supplier should know"
        placeholderTextColor={colors.textSubtle}
        multiline
        style={[styles.field, styles.notes]}
      />

      {/* Spec 6.5 Send — the channel chooser. */}
      <Modal
        visible={choosingChannel}
        onClose={() => setChoosingChannel(false)}
        variant="dialog"
        title="How should this be sent?"
      >
        {availableChannels(Boolean(supplier?.is_active)).map((c) => (
          <Pressable key={c.key} style={styles.channel} onPress={() => handleSend(c.key)}>
            <Ionicons name={c.icon} size={22} color={colors.accent} />
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>{c.label}</Text>
              <Text style={[text.caption, styles.muted]}>{c.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </Modal>

      {/* Spec 6.5 — the overwrite warning, shown only when there is an edit to lose. */}
      <Modal
        visible={confirmingSupplierChange}
        onClose={() => setConfirmingSupplierChange(false)}
        variant="dialog"
        title="Replace your edited message?"
        footer={
          <View style={styles.footerRow}>
            <Button
              label="Cancel"
              variant="outline"
              onPress={() => setConfirmingSupplierChange(false)}
              style={styles.flex}
            />
            <Button
              label="Continue"
              variant="accent"
              onPress={() => {
                setConfirmingSupplierChange(false);
                onChangeSupplier();
              }}
              style={styles.flex}
            />
          </View>
        }
      >
        <Text style={[text.body, styles.muted]}>
          Changing the supplier will replace your edited message, because a different supplier
          has different prices and available quantities.
        </Text>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  supplier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  supplierText: { flex: 1, gap: 2 },
  supplierMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionLabel: { color: colors.textMuted, marginTop: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lineText: { flex: 1, gap: 2 },
  qty: {
    width: 64,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
  },
  qtyBad: { borderColor: colors.danger, color: colors.danger },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  message: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 150,
    textAlignVertical: 'top',
    fontFamily,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  messageLocked: { backgroundColor: colors.surfaceMuted, color: colors.textMuted },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
  },
  notes: { minHeight: 64, textAlignVertical: 'top' },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  footer: { gap: spacing.md },
  footerRow: { flexDirection: 'row', gap: spacing.md },
});
