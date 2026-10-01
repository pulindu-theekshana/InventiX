/**
 * Returns
 *
 * Purpose : Goods coming back. Find the bill by its receipt number, choose what is coming back, and give the money back.
 * Spec    : Section 6.6
 * Look here when : A return cannot find a bill, or returns more than was sold.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { useSubmit } from '../../src/hooks/useSubmit';
import { findSale, recordReturn } from '../../src/api/pos';
import * as device from '../../src/pos/device';
import { newId } from '../../src/pos/ids';
import type { Sale } from '../../src/types/api';

export default function Returns() {
  const submit = useSubmit();
  const [receipt, setReceipt] = useState('');
  const [bill, setBill] = useState<Sale | null>(null);
  const [coming, setComing] = useState<Record<string, number>>({});
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    setError(null);
    setDone(null);
    setBill(null);
    setComing({});
    try {
      const found = await findSale(receipt.trim());
      setBill(found);
    } catch (e) {
      /**
       * A return needs the original bill's prices, which only the backend holds, so this screen
       * cannot work offline. Saying so is better than queueing a refund nobody can price.
       */
      setError(e instanceof Error ? e.message : 'Could not reach the backend to find that bill.');
    }
  }

  /** What is left on a line: sold, minus whatever has already come back. */
  function left(line: Sale['lines'][number]): number {
    return Math.max(line.quantity - line.returned_quantity, 0);
  }

  const refund = (bill?.lines ?? []).reduce(
    (sum, l) => sum + (coming[l.catalog_product_id] ?? 0) * l.unit_price,
    0,
  );
  const anything = Object.values(coming).some((q) => q > 0);

  async function giveBack() {
    if (!bill || !anything) return;
    const ok = await submit.run(async () => {
      await recordReturn({
        client_sale_id: newId(),
        receipt_no: await device.nextReceiptNo(),
        device_id: await device.getDeviceId(),
        returns_receipt_no: bill.receipt_no,
        sold_at: new Date().toISOString(),
        cashier_label: null,
        reason: null,
        lines: Object.entries(coming)
          .filter(([, q]) => q > 0)
          .map(([catalog_product_id, quantity]) => ({ catalog_product_id, quantity })),
      });
    });
    if (!ok) return;
    setDone(`${currency(refund)} returned against ${bill.receipt_no}`);
    setBill(null);
    setComing({});
    setReceipt('');
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.find}>
        <Input
          value={receipt}
          onChangeText={setReceipt}
          onSubmitEditing={find}
          placeholder="Receipt number, e.g. T1-000147"
          icon="receipt-outline"
          autoCapitalize="characters"
          autoFocus
          containerStyle={styles.flex}
        />
        <Button label="Find" variant="outline" onPress={find} disabled={!receipt.trim()} />
      </View>

      <ErrorBanner message={error} />
      <ErrorBanner message={submit.error} />
      {done ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[text.label, { color: colors.success }]}>{done}</Text>
        </View>
      ) : null}

      {bill ? (
        <View style={styles.bill}>
          <Text style={text.h2}>{bill.receipt_no}</Text>
          <Text style={[text.caption, styles.muted]}>
            {new Date(bill.sold_at).toLocaleString()} · {currency(bill.total)} paid
          </Text>

          {bill.lines.map((line) => {
            const remaining = left(line);
            const chosen = coming[line.catalog_product_id] ?? 0;
            return (
              <View key={line.catalog_product_id} style={styles.line}>
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>{line.name}</Text>
                  <Text style={[text.caption, styles.muted]}>
                    {line.quantity} sold at {currency(line.unit_price)}
                    {line.returned_quantity > 0 ? ` · ${line.returned_quantity} already back` : ''}
                  </Text>
                </View>

                {remaining === 0 ? (
                  <Text style={[text.caption, styles.muted]}>All returned</Text>
                ) : (
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() =>
                        setComing((c) => ({
                          ...c,
                          [line.catalog_product_id]: Math.max(chosen - 1, 0),
                        }))
                      }
                      style={styles.step}
                    >
                      <Ionicons name="remove" size={18} color={colors.brandInk} />
                    </Pressable>
                    <Text style={[text.bodyStrong, styles.qty]}>{chosen}</Text>
                    <Pressable
                      onPress={() =>
                        setComing((c) => ({
                          ...c,
                          // Never more than is left: the backend refuses it, and a cashier
                          // should find that out before the customer is told a number.
                          [line.catalog_product_id]: Math.min(chosen + 1, remaining),
                        }))
                      }
                      style={styles.step}
                    >
                      <Ionicons name="add" size={18} color={colors.brandInk} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.totals}>
            <Text style={text.h2}>Give back</Text>
            <Text style={text.h2}>{currency(refund)}</Text>
          </View>

          <Button
            label="Return these items"
            variant="accent"
            size="lg"
            icon="arrow-undo"
            loading={submit.busy}
            disabled={!anything}
            onPress={giveBack}
            fullWidth
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  find: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  done: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bill: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  step: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { minWidth: 28, textAlign: 'center' },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
