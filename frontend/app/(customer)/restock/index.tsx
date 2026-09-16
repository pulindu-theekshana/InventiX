/**
 * Restock request
 *
 * Purpose : The most important screen. Message area, per-product quantities, delivery date, notes, and the Edit, Send and Change supplier actions. Owns the edited-since-generated flag and the overwrite warning.
 * Spec    : Section 6.5
 * Look here when : Send is wrongly disabled, or changing supplier loses an edit without warning.
 *
 * NOTE: this was a popup rendered inside the Stocks list, which is why it could only be
 * opened from there. As a route the product page and, later, a notification can open it too.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { elevation, radius, spacing } from '../../../src/theme/spacing';
import { fontFamily, fontSize, text } from '../../../src/theme/typography';
import { currency, rating } from '../../../src/lib/format';
import { toMessage } from '../../../src/lib/errors';
import { availableChannels } from '../../../src/constants/channels';
import { generateMessage, newIdempotencyKey, sendOrder } from '../../../src/api/ordering';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { Channel } from '../../../src/types/database';

export default function Restock() {
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getDraft, draftStore.getDraft);
  const [editing, setEditing] = useState(false);
  const [choosingChannel, setChoosingChannel] = useState(false);
  const [confirmingSupplierChange, setConfirmingSupplierChange] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  /** One key per visit, so a retry on a bad connection cannot create two orders. */
  const [idempotencyKey] = useState(newIdempotencyKey);

  const problems = useMemo(() => draftStore.validate(draft), [draft]);

  /**
   * The message names the delivery date and repeats the note, so both have to be rebuilt
   * into it — otherwise a shop types a note, sends, and the supplier never sees it.
   *
   * On blur rather than on every keystroke: one request when they finish typing. Skipped
   * once the message has been edited by hand, which is theirs to keep.
   */
  async function regenerate() {
    const current = draftStore.getDraft();
    if (!current || current.message_edited) return;
    try {
      const { message_body } = await generateMessage(current.lines, current.supplier, undefined, {
        notes: current.notes,
        requested_delivery_date: current.requested_delivery_date,
      });
      draftStore.applyRegenerated(message_body);
    } catch {
      /* Leave the previous text in place: the send rebuilds it server-side regardless. */
    }
  }

  /**
   * Reached with nothing to send: the draft is dropped when an order goes through, so this
   * is what a back-navigation onto a finished request looks like.
   */
  if (!draft) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="cart-outline"
          title="Nothing to order"
          message="Choose a product from your stock list to start a restock request."
          actionLabel="Back to Stocks"
          onAction={() => router.replace('/(customer)/stocks')}
        />
      </View>
    );
  }

  const supplier = draft.supplier;
  const multi = draft.lines.length > 1;
  const total = draft.lines.reduce(
    (sum, l) => sum + l.quantity_requested * (l.unit_price ?? 0),
    0,
  );

  function close() {
    draftStore.closeDraft();
    router.back();
  }

  /**
   * Spec 6.5: silently regenerate when nothing was edited, warn first when something was.
   * The message is regenerated in full by the backend, never patched, because a different
   * supplier has different prices, availability and minimums.
   */
  function handleChangeSupplier() {
    if (draft && draft.message_edited) setConfirmingSupplierChange(true);
    else router.push('/(customer)/restock/supplier' as never);
  }

  async function handleSend(channel: Channel) {
    if (!draft) return;
    setChoosingChannel(false);
    setSending(true);
    setSendError(null);
    try {
      const result = await sendOrder(draft, channel, idempotencyKey);
      draftStore.closeDraft();
      router.replace(`/(customer)/delivery/${result.order_id}`);
    } catch (e) {
      setSendError(toMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
          onChangeText={(v) => draftStore.editMessage(v)}
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
          onBlur={regenerate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSubtle}
          style={styles.field}
        />

        <Text style={[text.label, styles.sectionLabel]}>Notes</Text>
        <TextInput
          value={draft.notes}
          onChangeText={(v) => draftStore.setField('notes', v)}
          onBlur={regenerate}
          placeholder="Anything else the supplier should know"
          placeholderTextColor={colors.textSubtle}
          multiline
          style={[styles.field, styles.notes]}
        />
      </ScrollView>

      <View style={[styles.footer, elevation(2)]}>
        <ErrorBanner messages={problems} tone="warning" />
        <ErrorBanner messages={draft.warnings} tone="info" />
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
        <View style={styles.footerRow}>
          <Button
            label="Discard"
            variant="outline"
            onPress={close}
            style={styles.flex}
          />
          <Button
            label="Change supplier"
            variant="outline"
            icon="swap-horizontal"
            onPress={handleChangeSupplier}
            style={styles.flex}
          />
        </View>
      </View>

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
                router.push('/(customer)/restock/supplier' as never);
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
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
  footer: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: 'row', gap: spacing.md },
});
