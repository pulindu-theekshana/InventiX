/**
 * Till activity
 *
 * Purpose : Who sold what at the counter, and what is worth a second look. The owner's screen, read from their own phone rather than from the till.
 * Spec    : Section 6.6 and 7
 * Look here when : A cashier's takings look wrong, or a discount nobody approved needs finding.
 */

import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Tabs } from '../../../src/components/ui/Tabs';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, currencyShort } from '../../../src/lib/format';
import { tillActivity } from '../../../src/api/pos';
import type { TillActivity } from '../../../src/types/api';

type Range = '1' | '7' | '30';

const RANGES = [
  { value: '1' as const, label: 'Today' },
  { value: '7' as const, label: 'Last 7 days' },
  { value: '30' as const, label: 'Last 30 days' },
];

/**
 * The phone's own date, written out by hand.
 *
 * `toISOString()` is UTC: in Colombo, between midnight and 5.30am it names yesterday, so "Today"
 * at 1am would quietly show the day before and the evening's bills would be missing from it.
 */
function days(back: number): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (back - 1));
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(start), to: iso(end) };
}

export default function TillActivityScreen() {
  const [range, setRange] = useState<Range>('7');
  const [data, setData] = useState<TillActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (which: Range) => {
    setBusy(true);
    setError(null);
    try {
      const { from, to } = days(Number(which));
      setData(await tillActivity(from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the till.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(range);
    }, [load, range]),
  );

  function choose(next: Range) {
    setRange(next);
    void load(next);
  }

  const people = data?.by_cashier ?? [];
  const events = data?.events ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => load(range)} />}
    >
      <Tabs options={RANGES} value={range} onChange={choose} />
      <ErrorBanner message={error} />

      <View style={styles.tiles}>
        <Tile label="Sold" value={currencyShort(data?.sales_total ?? 0)} note={`${data?.bills ?? 0} bill(s)`} />
        <Tile label="Given back" value={currencyShort(data?.returns_total ?? 0)} />
        <Tile label="Discounts" value={currencyShort(data?.discounts_total ?? 0)} />
      </View>

      {/* ------------------------------------------------------------ per person */}
      <Card style={styles.card}>
        <Text style={text.title}>By cashier</Text>
        {people.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>
            {busy ? 'Reading the till…' : 'Nothing sold in this period.'}
          </Text>
        ) : (
          people.map((p) => (
            <View key={(p.cashier_id ?? p.cashier) ?? 'unnamed'} style={styles.person}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textMuted} />
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{p.cashier ?? 'Not recorded'}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {p.bills} bill(s)
                  {p.discounts_total > 0 ? ` · ${currency(p.discounts_total)} discounted` : ''}
                  {p.returns_total > 0 ? ` · ${currency(p.returns_total)} returned` : ''}
                </Text>
                {/*
                  Bills taken before cashier accounts existed carry a typed name and no account,
                  and the owner should know which of the two they are reading.
                */}
                {p.cashier && !p.cashier_id ? (
                  <Text style={[text.caption, styles.subtle]}>
                    typed at the till, before staff logins
                  </Text>
                ) : null}
              </View>
              <Text style={text.bodyStrong}>{currency(p.sales_total)}</Text>
            </View>
          ))
        )}
      </Card>

      {/* ------------------------------------------------------------ worth a look */}
      <Card style={styles.card}>
        <Text style={text.title}>Worth a look</Text>
        <Text style={[text.caption, styles.muted]}>
          Every discount and every return, newest first. A marked one was above your limit, so you
          should have been asked for your PIN.
        </Text>
        {events.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>
            {busy ? '…' : 'No discounts and no returns in this period.'}
          </Text>
        ) : (
          events.map((e) => (
            <View key={e.receipt_no} style={styles.event}>
              <Ionicons
                name={e.kind === 'return' ? 'arrow-undo-outline' : 'pricetag-outline'}
                size={18}
                color={e.above_limit ? colors.warning : colors.textMuted}
              />
              <View style={styles.flex}>
                <Text style={text.body}>
                  {e.kind === 'return' ? 'Return' : 'Discount'} · {e.cashier ?? 'Not recorded'}
                </Text>
                <Text style={[text.caption, styles.muted]}>
                  {e.receipt_no} · {when(e.sold_at)}
                </Text>
              </View>
              <View style={styles.amount}>
                <Text style={[text.bodyStrong, e.above_limit && { color: colors.warning }]}>
                  {currency(e.kind === 'return' ? e.total : e.discount)}
                </Text>
                {e.above_limit ? (
                  <Text style={[text.caption, { color: colors.warning }]}>above your limit</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Card>

      <Text style={[text.caption, styles.subtle]}>
        Bills are stored under the shop with the name of the account that was signed in, so this
        does not need the laptop in front of you.
      </Text>
    </ScrollView>
  );
}

/** "2 Oct, 9:28 PM" — the date matters once the range is longer than a day. */
function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(
    undefined,
    { hour: 'numeric', minute: '2-digit' },
  )}`;
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[text.caption, styles.muted]}>{label}</Text>
      <Text style={text.h2}>{value}</Text>
      {note ? <Text style={[text.caption, styles.subtle]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  card: { gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amount: { alignItems: 'flex-end' },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  subtle: { color: colors.textSubtle },
});
