/**
 * Day close
 *
 * Purpose : What the cashier counts the drawer against: today's bills, what should be in cash, and anything still unsent.
 * Spec    : Section 6.6
 * Look here when : The drawer disagrees with the app, or a bill is missing from the day.
 */

import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { usePosQueue } from '../../src/hooks/usePosQueue';
import { daySummary, listSales } from '../../src/api/pos';
import type { DaySummary, Sale } from '../../src/types/api';

export default function Close() {
  const outbox = usePosQueue();
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [bills, setBills] = useState<Sale[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([daySummary(), listSales()]);
      setSummary(s);
      setBills(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read today from the backend.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    >
      <ErrorBanner message={error} />

      {/*
        Unsent bills come first. A drawer counted while sales are still queued will not match
        the figure below, and the cashier should know that before they start counting.
      */}
      {outbox.waiting > 0 || outbox.stuck > 0 ? (
        <View style={styles.warn}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <Text style={[text.label, styles.flex]}>
            {outbox.waiting > 0 ? `${outbox.waiting} bill(s) not sent yet. ` : ''}
            {outbox.stuck > 0 ? `${outbox.stuck} rejected. ` : ''}
            Today&apos;s figures are missing them.
          </Text>
          <Button label="Try now" variant="outline" onPress={() => outbox.syncNow().then(load)} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={[text.caption, styles.muted]}>Cash that should be in the drawer</Text>
        <Text style={styles.big}>{currency(summary?.cash_expected ?? 0)}</Text>
        <Text style={[text.caption, styles.muted]}>
          {summary?.bills ?? 0} bill(s) · {summary?.date ?? ''}
        </Text>
      </View>

      <View style={styles.grid}>
        <Tile label="Sales" value={currency(summary?.sales_total ?? 0)} />
        <Tile label="Returns" value={currency(summary?.returns_total ?? 0)} />
        <Tile label="Card" value={currency(summary?.card_total ?? 0)} />
        <Tile label="Other" value={currency(summary?.other_total ?? 0)} />
      </View>

      {(summary?.by_cashier ?? []).length > 1 ? (
        <View style={styles.card}>
          <Text style={text.title}>By cashier</Text>
          {summary?.by_cashier.map((c) => (
            <View key={c.cashier ?? 'unnamed'} style={styles.row}>
              <Text style={[text.body, styles.flex]}>{c.cashier ?? 'Not recorded'}</Text>
              <Text style={[text.caption, styles.muted]}>{c.bills} bill(s)</Text>
              <Text style={text.bodyStrong}>{currency(c.sales_total)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={text.title}>Today&apos;s bills</Text>
      {bills.length === 0 ? (
        <Text style={[text.label, styles.muted]}>Nothing sold yet today.</Text>
      ) : (
        bills.map((bill) => (
          <View key={bill.id} style={styles.bill}>
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>
                {bill.receipt_no}
                {bill.kind === 'return' ? '  ·  return' : ''}
              </Text>
              <Text style={[text.caption, styles.muted]}>
                {new Date(bill.sold_at).toLocaleTimeString()} · {bill.lines.length} item(s) ·{' '}
                {bill.payment_method}
              </Text>
            </View>
            <Text
              style={[
                text.bodyStrong,
                bill.kind === 'return' ? { color: colors.danger } : undefined,
              ]}
            >
              {bill.kind === 'return' ? '-' : ''}
              {currency(bill.total)}
            </Text>
          </View>
        ))
      )}

      <Button
        label="Back to the till"
        variant="outline"
        icon="arrow-back"
        onPress={() => router.replace('/pos')}
        fullWidth
      />
    </ScrollView>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[text.caption, styles.muted]}>{label}</Text>
      <Text style={text.bodyStrong}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  big: { ...text.h1, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
