/**
 * Stock item detail
 * 
 * Purpose : The only place a threshold is edited, a manual adjustment is recorded, or the adjustment history is read. Not in the Figma; spec 6.3 and 6.6 both require it.
 * Spec    : Section 6.3 and 6.6
 * Look here when : A threshold edit or manual adjustment misbehaves.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Modal } from '../../../src/components/ui/Modal';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, date, quantity } from '../../../src/lib/format';
import { useAdjustments, useStockItem } from '../../../src/hooks/useStocks';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { adjustQuantity, updateThreshold } from '../../../src/api/stocks';
import { generateMessage } from '../../../src/api/ordering';
import { searchByProduct } from '../../../src/api/suppliers';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { RestockLine, SupplierView } from '../../../src/types/api';

const REASONS = ['manual', 'damage', 'correction'] as const;

export default function StockDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStockItem(id);
  const history = useAdjustments(id);
  const [threshold, setThreshold] = useState('');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]>('manual');
  const submit = useSubmit();
  /** Held between asking "you already ordered this" and the owner answering. */
  const [pending, setPending] = useState<{ line: RestockLine; supplier: SupplierView | null; message: string; warnings: string[]; duplicates: string[] } | null>(null);

  const data = item.data;
  if (item.loading) return <View style={styles.root} />;
  if (!data) return <ErrorBanner message="That product could not be found." />;

  async function saveThreshold() {
    const ok = await submit.run(() => updateThreshold(id, Number(threshold)));
    if (!ok) return;
    setThreshold('');
    item.refresh();
  }

  async function saveAdjustment() {
    // Damage always removes stock, so "6 damaged" and "-6 damaged" mean the same thing.
    // Without this, typing 6 with damage selected adds six units.
    const amount = reason === 'damage' ? -Math.abs(Number(change)) : Number(change);
    const ok = await submit.run(() => adjustQuantity(id, amount, reason));
    if (!ok) return;
    setChange('');
    item.refresh();
    history.refresh();
  }

  /**
   * Spec 6.5. Reorder starts here rather than on the list, because this is the screen an
   * owner is on when they decide -- a low stock notification lands them here.
   */
  async function reorder() {
    if (!data) return;
    await submit.run(async () => {
      const suppliers = await searchByProduct(data.product.id);
      const supplier =
        suppliers.find((s) => s.id === data.preferred_supplier_id) ?? suppliers[0] ?? null;

      // Without one there is nobody to send to, and the backend would refuse the request
      // with a less helpful message than this one.
      if (!supplier) {
        throw new Error(`No supplier on InventiX lists ${data.product.name} yet.`);
      }

      const line: RestockLine = {
        stock_item_id: data.id,
        catalog_product_id: data.product.id,
        name: data.product.name,
        pack_size: data.product.pack_size,
        // Enough to clear the warning level with the same margin the list screen uses.
        quantity_requested: Math.max(data.low_threshold * 2 - data.quantity_on_hand, 1),
        quantity_available: supplier?.listing?.quantity_available ?? null,
        min_order_quantity: supplier?.listing?.min_order_quantity ?? null,
        unit_price: data.unit_price,
      };

      const { message_body, warnings, duplicates } = await generateMessage([line], supplier);
      const next = { line, supplier, message: message_body, warnings, duplicates };

      // Already on order with this same supplier: ask before writing a second one.
      if (duplicates.length > 0) setPending(next);
      else openMessage(next);
    });
  }

  function openMessage(p: NonNullable<typeof pending>, confirmed = false) {
    setPending(null);
    draftStore.openDraft([p.line], p.supplier, p.message, [...p.warnings, ...p.duplicates], confirmed);
    router.push('/(customer)/stocks/restock');
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ErrorBanner message={submit.error} />
      <Card style={styles.gap}>
        <Text style={text.h2}>{data.product.name}</Text>
        <Text style={[text.label, styles.muted]}>
          {data.product.pack_size} · {data.product.category}
        </Text>
        <View style={styles.figures}>
          <Figure label="On hand" value={quantity(data.quantity_on_hand)} />
          <Figure label="Low at" value={quantity(data.low_threshold)} />
          <Figure label="Unit price" value={currency(data.unit_price)} />
        </View>
        {data.restock_requested ? <Badge label="Restock requested" tone="info" /> : null}
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Low stock threshold</Text>
        <Text style={[text.caption, styles.muted]}>
          Below this the product moves into Low stock. Ten bags of rice may be low while two
          hundred packets of tea is normal, so this is per product.
        </Text>
        <Input
          value={threshold}
          onChangeText={setThreshold}
          placeholder={String(data.low_threshold)}
          keyboardType="number-pad"
          icon="trending-down-outline"
        />
        <Button
          label="Save threshold"
          variant="accent"
          disabled={!threshold || Number(threshold) < 0}
          loading={submit.busy}
          onPress={saveThreshold}
        />
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Record an adjustment</Text>
        <Text style={[text.caption, styles.muted]}>
          For damage, spoilage or a miscount. Use a negative number to reduce -- with Damage
          selected, just enter how many were damaged. Every change writes an audit row, so a
          wrong figure can always be traced.
        </Text>
        <Input
          value={change}
          onChangeText={setChange}
          placeholder="-5"
          keyboardType="numbers-and-punctuation"
          icon="swap-vertical-outline"
        />
        <View style={styles.reasons}>
          {REASONS.map((r) => (
            <Button
              key={r}
              label={r}
              size="sm"
              variant={reason === r ? 'accent' : 'outline'}
              onPress={() => setReason(r)}
            />
          ))}
        </View>
        <Button
          label="Record adjustment"
          variant="accent"
          disabled={!change || Number.isNaN(Number(change)) || Number(change) === 0}
          loading={submit.busy}
          onPress={saveAdjustment}
        />
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Running low?</Text>
        <Text style={[text.caption, styles.muted]}>
          Sends a restock request to {data.preferred_supplier_name ?? 'a supplier who sells it'},
          with a message you can read and edit first.
        </Text>
        <Button
          label="Reorder this product"
          variant="send"
          icon="cart-outline"
          loading={submit.busy}
          onPress={reorder}
        />
      </Card>

      <Modal
        visible={pending !== null}
        onClose={() => setPending(null)}
        title="Already on order"
        variant="dialog"
        footer={
          <View style={styles.reasons}>
            <Button label="Cancel" variant="outline" onPress={() => setPending(null)} />
            <Button
              label="Reorder anyway"
              variant="accent"
              onPress={() => pending && openMessage(pending, true)}
            />
          </View>
        }
      >
        <Text style={text.body}>{pending?.duplicates.join(' ')}</Text>
        <Text style={[text.caption, styles.muted]}>
          Both deliveries would arrive, and your stock would go up twice. Reorder only if you
          really need more.
        </Text>
      </Modal>

      <Card style={styles.gap}>
        <Text style={text.title}>History</Text>
        {(history.data ?? []).length === 0 ? (
          <Text style={[text.caption, styles.muted]}>No changes recorded yet.</Text>
        ) : (
          (history.data ?? []).map((a) => (
            <View key={a.id} style={styles.historyRow}>
              <View
                style={[
                  styles.historyIcon,
                  { backgroundColor: a.change_quantity < 0 ? colors.dangerBg : colors.successBg },
                ]}
              >
                <Ionicons
                  name={a.change_quantity < 0 ? 'arrow-down' : 'arrow-up'}
                  size={14}
                  color={a.change_quantity < 0 ? colors.danger : colors.success}
                />
              </View>
              <View style={styles.flex}>
                <Text style={text.label}>
                  {a.change_quantity > 0 ? '+' : ''}
                  {a.change_quantity} · now {a.quantity_after}
                </Text>
                <Text style={[text.caption, styles.muted]}>
                  {a.reason.replace('_', ' ')} · {date(a.created_at)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <Text style={[text.caption, styles.muted]}>{label}</Text>
      <Text style={text.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  muted: { color: colors.textMuted },
  figures: { flexDirection: 'row', gap: spacing.xl },
  figure: { gap: 2 },
  reasons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyIcon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
