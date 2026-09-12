/**
 * Stock item detail
 * 
 * Purpose : The only place a threshold is edited, a manual adjustment is recorded, or the adjustment history is read. Not in the Figma; spec 6.3 and 6.6 both require it.
 * Spec    : Section 6.3 and 6.6
 * Look here when : A threshold edit or manual adjustment misbehaves.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, date, quantity } from '../../../src/lib/format';
import { useAdjustments, useStockItem } from '../../../src/hooks/useStocks';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { adjustQuantity, updateThreshold } from '../../../src/api/stocks';

const REASONS = ['manual', 'damage', 'correction'] as const;

export default function StockDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStockItem(id);
  const history = useAdjustments(id);
  const [threshold, setThreshold] = useState('');
  const [change, setChange] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]>('manual');
  const submit = useSubmit();

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
    const ok = await submit.run(() => adjustQuantity(id, Number(change), reason));
    if (!ok) return;
    setChange('');
    item.refresh();
    history.refresh();
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
          For damage, spoilage or a miscount. Use a negative number to reduce. Every change
          writes an audit row, so a wrong figure can always be traced.
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
