/**
 * Sell screen
 *
 * Purpose : The counter. Scan or search a product, build a bill, take cash, finish. The bill is written to the device and sent afterwards, so nothing here waits for the network.
 * Spec    : Section 6.6
 * Look here when : A product cannot be found at the till, a total is wrong, or a finished bill does not reach the backend.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { useStocks } from '../../src/hooks/useStocks';
import { usePosQueue } from '../../src/hooks/usePosQueue';
import * as cart from '../../src/pos/cart';
import * as device from '../../src/pos/device';
import * as queue from '../../src/pos/queue';
import type { CartLine } from '../../src/pos/cart';
import type { StockItemView } from '../../src/types/api';

type Payment = 'cash' | 'card' | 'other';

export default function Sell() {
  const stocks = useStocks();
  const outbox = usePosQueue();

  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [error, setError] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<string | null>(null);

  /** Focus goes back to the search box after every action: a scanner types, it does not tap. */
  const searchBox = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      stocks.refresh();
      searchBox.current?.focus();
    }, []),
  );

  const items = stocks.data ?? [];

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    // Barcode first and exact: a scanner's input is complete, so an exact match means
    // "this product", not "here are some to choose from".
    const exact = items.filter((i) => i.product.barcode?.toLowerCase() === q);
    if (exact.length) return exact;
    return items.filter((i) => i.product.name.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  const discountValue = Number(discount) || 0;
  const total = cart.cartTotal(lines, discountValue);
  const changeDue = cart.change(total, Number(cashGiven) || 0);

  function add(item: StockItemView) {
    setLines((current) => cart.addLine(current, cart.lineOf(item)));
    setQuery('');
    searchBox.current?.focus();
  }

  /** A scanner ends its input with Enter. One exact barcode match is added without a tap. */
  function onSubmitSearch() {
    if (matches.length === 1) add(matches[0]);
  }

  function clearBill() {
    setLines([]);
    setDiscount('');
    setCashGiven('');
    setPayment('cash');
  }

  async function finish() {
    if (!lines.length) return;
    setError(null);
    try {
      const receipt_no = await device.nextReceiptNo();
      await queue.enqueue({
        client_sale_id: newId(),
        receipt_no,
        device_id: await device.getDeviceId(),
        sold_at: new Date().toISOString(),
        payment_method: payment,
        discount: discountValue,
        cashier_label: null,
        lines: lines.map((l) => ({
          catalog_product_id: l.catalog_product_id,
          stock_item_id: l.stock_item_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      });
      setLastReceipt(receipt_no);
      clearBill();
      // The stock figures on screen are now one sale out of date.
      stocks.refresh();
      searchBox.current?.focus();
    } catch (e) {
      // Only storage can fail here; the network cannot, because nothing is sent yet.
      setError(e instanceof Error ? e.message : 'The bill could not be saved on this device.');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.bar}>
        <Input
          ref={searchBox}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmitSearch}
          placeholder="Scan a barcode, or type a product name"
          icon="search"
          autoFocus
          returnKeyType="done"
          containerStyle={styles.flex}
        />
        <View style={styles.status}>
          {outbox.waiting > 0 ? (
            <Text style={[text.caption, { color: colors.warning }]}>
              {outbox.waiting} waiting to sync
            </Text>
          ) : (
            <Text style={[text.caption, { color: colors.textSubtle }]}>All sales sent</Text>
          )}
          {outbox.stuck > 0 ? (
            <Text style={[text.caption, { color: colors.danger }]}>{outbox.stuck} rejected</Text>
          ) : null}
        </View>
      </View>

      <ErrorBanner message={error} />
      <ErrorBanner message={stocks.error} />

      {query.trim().length > 0 ? (
        <View style={styles.results}>
          {matches.length === 0 ? (
            <Text style={[text.label, styles.muted]}>Nothing matches “{query.trim()}”.</Text>
          ) : (
            matches.map((item) => (
              <Pressable key={item.id} onPress={() => add(item)} style={styles.result}>
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>{item.product.name}</Text>
                  <Text style={[text.caption, styles.muted]}>
                    {item.product.pack_size} · {item.quantity_on_hand} in stock
                  </Text>
                </View>
                <Text style={text.bodyStrong}>{currency(item.unit_price ?? 0)}</Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      <FlatList
        data={lines}
        keyExtractor={(l) => l.catalog_product_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cart-outline" size={34} color={colors.textSubtle} />
            <Text style={[text.label, styles.muted]}>Scan the first item</Text>
            {lastReceipt ? (
              <Text style={[text.caption, { color: colors.success }]}>
                {lastReceipt} saved
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.line}>
            <View style={styles.flex}>
              <Text style={text.bodyStrong} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[text.caption, styles.muted]}>
                {item.pack_size} · {currency(item.unit_price)} each
                {item.quantity_on_hand !== null && item.quantity > item.quantity_on_hand
                  ? `  ·  only ${item.quantity_on_hand} recorded`
                  : ''}
              </Text>
            </View>

            <View style={styles.stepper}>
              <Pressable
                onPress={() => setLines((c) => cart.setQuantity(c, index, item.quantity - 1))}
                style={styles.step}
                accessibilityLabel={`One less ${item.name}`}
              >
                <Ionicons name="remove" size={18} color={colors.brandInk} />
              </Pressable>
              <TextInput
                value={String(item.quantity)}
                onChangeText={(v) => setLines((c) => cart.setQuantity(c, index, Number(v) || 0))}
                keyboardType="decimal-pad"
                style={styles.qty}
                selectTextOnFocus
              />
              <Pressable
                onPress={() => setLines((c) => cart.setQuantity(c, index, item.quantity + 1))}
                style={styles.step}
                accessibilityLabel={`One more ${item.name}`}
              >
                <Ionicons name="add" size={18} color={colors.brandInk} />
              </Pressable>
            </View>

            <Text style={[text.bodyStrong, styles.lineTotal]}>
              {currency(cart.lineTotal(item))}
            </Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.row}>
          <Input
            value={discount}
            onChangeText={setDiscount}
            placeholder="Discount"
            keyboardType="decimal-pad"
            containerStyle={styles.flex}
          />
          <Input
            value={cashGiven}
            onChangeText={setCashGiven}
            placeholder="Cash given"
            keyboardType="decimal-pad"
            containerStyle={styles.flex}
          />
        </View>

        <View style={styles.row}>
          {(['cash', 'card', 'other'] as Payment[]).map((method) => (
            <Pressable
              key={method}
              onPress={() => setPayment(method)}
              style={[styles.pay, payment === method && styles.payOn]}
            >
              <Text style={[text.label, payment === method && { color: colors.brandInk }]}>
                {method === 'cash' ? 'Cash' : method === 'card' ? 'Card' : 'Other'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.totals}>
          <Text style={text.h2}>Total</Text>
          <Text style={text.h2}>{currency(total)}</Text>
        </View>
        {Number(cashGiven) > 0 ? (
          <View style={styles.totals}>
            <Text style={[text.label, styles.muted]}>Change</Text>
            <Text style={[text.bodyStrong, { color: colors.success }]}>{currency(changeDue)}</Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <Button
            label="Clear"
            variant="outline"
            onPress={clearBill}
            disabled={!lines.length}
            style={styles.flex}
          />
          <Button
            label="Finish sale"
            variant="accent"
            size="lg"
            icon="checkmark"
            onPress={finish}
            disabled={!lines.length}
            style={styles.flexTwo}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** crypto.randomUUID is not in every runtime this app meets, so a fallback is kept. */
function newId(): string {
  const maybe = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (maybe?.randomUUID) return maybe.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  status: { alignItems: 'flex-end', gap: 2 },
  flex: { flex: 1 },
  flexTwo: { flex: 2 },
  muted: { color: colors.textMuted },
  results: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  step: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    minWidth: 54,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    color: colors.text,
  },
  lineTotal: { minWidth: 90, textAlign: 'right' },
  footer: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  pay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  payOn: { backgroundColor: colors.primaryTint },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
