/**
 * Day close
 *
 * Purpose : What the cashier counts the drawer against: today's bills, what should be in cash, and anything still unsent.
 * Spec    : Section 6.6
 * Look here when : The drawer disagrees with the app, or a bill is missing from the day.
 */

import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { usePosQueue } from '../../src/hooks/usePosQueue';
import { useAuth } from '../../src/hooks/useAuth';
import { ConfirmSignOut } from '../../src/components/ConfirmSignOut';
import { isOffline } from '../../src/lib/network';
import { signOut } from '../../src/stores/authStore';
import { readDay, type TillDay } from '../../src/pos/day';
import * as queue from '../../src/pos/queue';
import { cartTotal } from '../../src/pos/cart';
import { API_BASE_URL } from '../../src/api/client';

export default function Close() {
  const outbox = usePosQueue();
  const { isCashier } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [day, setDay] = useState<TillDay | null>(null);
  const [busy, setBusy] = useState(false);
  /** The bill the owner has tapped Remove on, waiting for them to mean it. */
  const [dropping, setDropping] = useState<string | null>(null);

  /**
   * Never throws and never shows an error: a till with no line still has to count its drawer, so
   * readDay() falls back to the last copy plus whatever has been rung since. What it cannot know,
   * it says on screen instead.
   */
  const load = useCallback(async () => {
    setBusy(true);
    setDay(await readDay());
    setBusy(false);
  }, []);

  const summary = day?.summary ?? null;
  const bills = day?.bills ?? [];

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
      {/*
        The drawer is counted against both halves: what the backend has been sent, and what is
        still on this till. Saying which is which is the difference between a figure a cashier
        can trust and one they quietly stop believing.
      */}
      {day && day.source !== 'server' ? (
        <View style={styles.warn}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
          <Text style={[text.label, styles.flex]}>
            {day.source === 'saved'
              ? `No connection. Sent bills are as this till last saw them${
                  day.serverAt ? ` at ${new Date(day.serverAt).toLocaleTimeString()}` : ''
                }, plus everything rung since.`
              : 'No connection, and nothing read from the backend today. These are the bills rung on this till.'}
          </Text>
        </View>
      ) : null}

      {/*
        A bill the backend refuses is not going to send itself, and until now nothing could get rid
        of it: the till counted "1 rejected" for ever. Removing one is the owner's decision and
        takes two taps, because a dropped sale is money that leaves no trace.
      */}
      {(day?.rejected ?? []).length > 0 ? (
        <View style={styles.card}>
          <Text style={text.title}>Refused by the backend</Text>
          <Text style={[text.caption, styles.muted]}>
            These are not in the figures above. Press Try now first — if a bill keeps coming back,
            something about it is wrong and only you can decide whether to drop it.
          </Text>
          {day?.rejected.map((row) => (
            <View key={row.sale.client_sale_id} style={styles.row}>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{row.sale.receipt_no}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {new Date(row.sale.sold_at).toLocaleTimeString()} ·{' '}
                  {currency(cartTotal(row.sale.lines, row.sale.discount))} ·{' '}
                  {row.sale.cashier_label ?? 'not recorded'}
                </Text>
                {row.lastError ? (
                  <Text style={[text.caption, { color: colors.danger }]}>{row.lastError}</Text>
                ) : null}
              </View>
              <Button
                label={dropping === row.sale.client_sale_id ? 'Really remove' : 'Remove'}
                variant="outline"
                onPress={async () => {
                  if (dropping !== row.sale.client_sale_id) {
                    setDropping(row.sale.client_sale_id);
                    return;
                  }
                  await queue.discard(row.sale.client_sale_id);
                  setDropping(null);
                  await load();
                }}
              />
            </View>
          ))}
        </View>
      ) : null}

      {outbox.waiting > 0 || outbox.stuck > 0 ? (
        <View style={styles.warn}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.warning} />
          <Text style={[text.label, styles.flex]}>
            {outbox.waiting > 0 ? `${outbox.waiting} bill(s) not sent yet. ` : ''}
            {outbox.stuck > 0 ? `${outbox.stuck} rejected. ` : ''}
            They are counted below and go when the connection is back.
            {outbox.error ? ` (${outbox.error} — sending to ${API_BASE_URL})` : ''}
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

      {/*
        Detection, not prevention: an employee who knows every discount and return carries their
        name behaves differently, and nobody is interrupted during a rush. Spec 6.6.
      */}
      {bills.some((b) => b.kind === 'return' || b.discount > 0) ? (
        <View style={styles.card}>
          <Text style={text.title}>Worth a look</Text>
          {bills
            .filter((b) => b.kind === 'return' || b.discount > 0)
            .map((b) => (
              <View key={`look-${b.id}`} style={styles.row}>
                <Text style={[text.body, styles.flex]}>
                  {b.receipt_no} · {b.kind === 'return' ? 'return' : `discount ${currency(b.discount)}`}
                </Text>
                <Text style={[text.caption, styles.muted]}>{b.cashier_label ?? 'not recorded'}</Text>
              </View>
            ))}
        </View>
      ) : null}

      <Text style={text.title}>Today&apos;s bills</Text>
      {bills.length === 0 ? (
        <Text style={[text.label, styles.muted]}>Nothing sold yet today.</Text>
      ) : (
        bills.map((bill) => (
          /**
           * A sale opens the return screen already loaded; a return has nothing to return, and
           * neither has a bill still sitting in the queue -- the backend has never seen it, so it
           * cannot price a return against it.
           */
          <Pressable
            key={bill.id}
            onPress={
              bill.kind === 'sale' && !bill.id.startsWith('queued-')
                ? () => router.push(`/pos/returns?receipt=${encodeURIComponent(bill.receipt_no)}`)
                : undefined
            }
            style={styles.bill}
          >
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>
                {bill.receipt_no}
                {bill.kind === 'return' ? '  ·  return' : ''}
              </Text>
              <Text style={[text.caption, styles.muted]}>
                {new Date(bill.sold_at).toLocaleTimeString()} · {bill.lines.length} item(s) ·{' '}
                {bill.payment_method}
                {bill.id.startsWith('queued-') ? ' · not sent yet' : ''}
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
            {bill.kind === 'sale' && !bill.id.startsWith('queued-') ? (
              <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
            ) : null}
          </Pressable>
        ))
      )}

      <Button
        label="Back to the till"
        variant="outline"
        icon="arrow-back"
        onPress={() => router.replace('/pos')}
        fullWidth
      />
      {/* Handing over. Signing out is the end of a shift now that the person at the counter is
          an account: the next one signs in, and their bills carry their own name. */}
      {isCashier ? (
        <Button
          label="End shift and sign out"
          variant="outline"
          icon="log-out-outline"
          onPress={() => setLeaving(true)}
          fullWidth
        />
      ) : null}

      <ConfirmSignOut
        visible={leaving}
        waiting={outbox.waiting}
        offline={isOffline()}
        onCancel={() => setLeaving(false)}
        onConfirm={async () => {
          setLeaving(false);
          await signOut();
          router.replace('/(auth)/login');
        }}
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
