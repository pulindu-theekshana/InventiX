/**
 * Sell screen
 *
 * Purpose : The counter. Scan or search a product, build a bill, take cash, finish. The bill is written to the device and sent afterwards, so nothing here waits for the network.
 * Spec    : Section 6.6
 * Look here when : A product cannot be found at the till, a total is wrong, or a finished bill does not reach the backend.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { ErrorBanner } from '../../src/components/ErrorBanner';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/spacing';
import { text } from '../../src/theme/typography';
import { currency } from '../../src/lib/format';
import { useStocks } from '../../src/hooks/useStocks';
import { saveBarcode } from '../../src/api/stocks';
import { usePosQueue } from '../../src/hooks/usePosQueue';
import { useAuth } from '../../src/hooks/useAuth';
import { OwnerPin } from '../../src/components/OwnerPin';
import * as cart from '../../src/pos/cart';
import * as device from '../../src/pos/device';
import * as queue from '../../src/pos/queue';
import * as settings from '../../src/pos/settings';
import { signOut } from '../../src/stores/authStore';
import { newId } from '../../src/pos/ids';
import { canPrint, printReceipt, type ReceiptBill } from '../../src/pos/receipt';
import type { CartLine } from '../../src/pos/cart';
import type { StockItemView } from '../../src/types/api';

type Payment = 'cash' | 'card' | 'other';

/**
 * What a scanner reads: digits, sometimes a letter prefix on a wholesaler's own label. Used only
 * to decide whether an unknown search term is worth offering to save -- a cashier typing "milk"
 * should not be asked which product "milk" is the barcode of.
 */
function looksLikeBarcode(value: string): boolean {
  return /^[A-Za-z0-9-]{6,32}$/.test(value.trim()) && /\d{6,}/.test(value.trim());
}

export default function Sell() {
  const stocks = useStocks();
  const outbox = usePosQueue();
  /**
   * Who is at the till is who signed in. Phase 5 asked on a screen and kept the answer on the
   * device, which meant the name on a bill was only as good as the honesty of whoever tapped
   * it. The backend now stamps the bill from the token and ignores what the till sends.
   */
  const { profile, isCashier, shopId } = useAuth();
  const cashier = profile?.contact_person ?? null;
  /**
   * The code a scan just produced that matches nothing, while the cashier picks the product it
   * belongs to. The shop's barcode list is built this way -- by selling, one unknown code at a
   * time -- because nobody is going to type EAN numbers into a form.
   */
  const [learning, setLearning] = useState<string | null>(null);
  /** What the owner is being asked to approve, or null when nothing is waiting. */
  const [approving, setApproving] = useState<'discount' | null>(null);

  const [query, setQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [payment, setPayment] = useState<Payment>('cash');
  const [error, setError] = useState<string | null>(null);
  /** The whole bill, not just its number: a customer asking for a copy wants the lines. */
  const [lastBill, setLastBill] = useState<ReceiptBill | null>(null);

  /** Focus goes back to the search box after every action: a scanner types, it does not tap. */
  const searchBox = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      stocks.refresh();
      settings.load();
      // Once per visit, and only when online: see device.catchUpWithServer.
      void device.catchUpWithServer();
      searchBox.current?.focus();
    }, []),
  );

  /**
   * A barcode scanner is a keyboard. It types wherever focus happens to be -- and after a tap on
   * a quantity stepper or a payment button, that is not the search box, so the first scan of the
   * next customer went nowhere. Any character typed outside a text field is taken as the start of
   * a scan: the box is focused and the character is put in by hand, because relying on the browser
   * to deliver a key to an element focused during that same keystroke loses the first digit.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Letters, digits and the separators barcodes use. Deliberately not space or Enter, which
      // belong to whatever button the cashier has just tabbed to.
      if (!/^[A-Za-z0-9\-_.]$/.test(event.key)) return;

      event.preventDefault();
      searchBox.current?.focus();
      setQuery((current) => current + event.key);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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
  const tendered = Number(cashGiven) || 0;
  const changeDue = cart.change(total, tendered);
  /**
   * A cash sale is only finished once the cashier has said what the customer handed over. It
   * stops a stray tap completing a bill, and it is the only way the screen can show change --
   * which is the number the customer is watching for.
   */
  const shortOfCash = payment === 'cash' && tendered < total;
  const canFinish = lines.length > 0 && !shortOfCash;

  function add(item: StockItemView) {
    setLines((current) => cart.addLine(current, cart.lineOf(item)));
    setQuery('');
    searchBox.current?.focus();
  }

  /**
   * Saves the code against the product the cashier tapped, then sells it, because the customer is
   * still standing there. A refusal is shown and the sale goes ahead anyway: a barcode that could
   * not be saved is a thing to sort out later, not a reason to stop a bill.
   */
  async function learn(item: StockItemView) {
    const code = learning;
    setLearning(null);
    add(item);
    if (!code) return;
    try {
      await saveBarcode(item.id, code);
      stocks.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That barcode could not be saved.');
    }
  }

  /** A scanner ends its input with Enter. One exact barcode match is added without a tap. */
  function onSubmitSearch() {
    if (matches.length !== 1) return;
    // While a code is being learned, Enter on the single match means "this is the one".
    if (learning) void learn(matches[0]);
    else add(matches[0]);
  }

  function clearBill() {
    setLines([]);
    setDiscount('');
    setCashGiven('');
    setPayment('cash');
  }

  /**
   * A discount is where a till leaks money, so anything above the owner's limit is approved by
   * them. Below it the cashier is not interrupted, which is what makes the limit usable at all.
   */
  function finishPressed() {
    if (settings.needsOwner(discountValue, settings.current().discount_limit, isCashier)) {
      setApproving('discount');
      return;
    }
    void finish();
  }

  /**
   * Leaving means two different things now. A cashier signs out, because the rest of the app is
   * not theirs and there is nothing for them on the other side of this button. The owner goes
   * back to their own app, and is not asked to approve themselves.
   */
  async function leavePressed() {
    if (isCashier) {
      await signOut();
      router.replace('/(auth)/login');
      return;
    }
    router.replace('/stocks');
  }

  async function finish() {
    if (!canFinish) return;
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
        cashier_label: cashier,
        lines: lines.map((l) => ({
          catalog_product_id: l.catalog_product_id,
          stock_item_id: l.stock_item_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
      });
      setLastBill({
        receipt_no,
        sold_at: new Date().toISOString(),
        shop: profile?.business_name ?? 'InventiX',
        cashier,
        lines: lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        discount: discountValue,
        total,
        tendered: payment === 'cash' ? tendered : null,
        change: payment === 'cash' ? changeDue : null,
      });
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
        {/* The owner's settings are reachable from the owner's account only. A cashier has no
            link, and the backend refuses the request even if one is typed into the address. */}
        {isCashier ? null : (
          <Pressable onPress={() => router.push('/pos/settings')} style={styles.link}>
            <Ionicons name="settings-outline" size={20} color={colors.accent} />
            <Text style={[text.caption, { color: colors.accent }]}>Settings</Text>
          </Pressable>
        )}
        <Pressable onPress={leavePressed} style={styles.link}>
          <Ionicons name="exit-outline" size={20} color={colors.accent} />
          <Text style={[text.caption, { color: colors.accent }]}>
            {isCashier ? 'Sign out' : 'Leave'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/pos/returns')} style={styles.link}>
          <Ionicons name="arrow-undo-outline" size={20} color={colors.accent} />
          <Text style={[text.caption, { color: colors.accent }]}>Return</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/pos/close')} style={styles.link}>
          <Ionicons name="calculator-outline" size={20} color={colors.accent} />
          <Text style={[text.caption, { color: colors.accent }]}>Day close</Text>
        </Pressable>
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
          {cashier ? (
            <Text style={[text.caption, { color: colors.textSubtle }]}>{cashier}</Text>
          ) : null}
        </View>
      </View>

      <ErrorBanner message={error} />
      <ErrorBanner message={stocks.error} />

      {/*
        The last bill stays on screen until the next one is finished. It used to disappear as
        soon as an item was scanned, which is exactly when a customer asks for the number.
      */}
      {lastBill ? (
        <View style={styles.lastBill}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[text.label, styles.flex]}>
            Last bill <Text style={text.bodyStrong}>{lastBill.receipt_no}</Text>
          </Text>
          {/* Printing is the browser's, so there is nothing to offer on a phone. */}
          {canPrint() ? (
            <Pressable onPress={() => printReceipt(lastBill)} style={styles.lastAction}>
              <Ionicons name="print-outline" size={16} color={colors.accent} />
              <Text style={[text.caption, { color: colors.accent }]}>Print</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              router.push(`/pos/returns?receipt=${encodeURIComponent(lastBill.receipt_no)}`)
            }
            style={styles.lastAction}
          >
            <Ionicons name="arrow-undo-outline" size={16} color={colors.accent} />
            <Text style={[text.caption, { color: colors.accent }]}>Return</Text>
          </Pressable>
        </View>
      ) : null}

      {learning ? (
        <View style={styles.learning}>
          <Ionicons name="barcode-outline" size={18} color={colors.brandInk} />
          <Text style={[text.label, styles.flex]}>
            Which product is <Text style={text.bodyStrong}>{learning}</Text>? Search for it and tap
            it once — every scan after this will find it.
          </Text>
          <Pressable onPress={() => setLearning(null)} hitSlop={8}>
            <Text style={[text.caption, { color: colors.brandInk }]}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {query.trim().length > 0 ? (
        <View style={styles.results}>
          {matches.length === 0 ? (
            <View style={styles.noMatch}>
              <Text style={[text.label, styles.muted]}>Nothing matches “{query.trim()}”.</Text>
              {/* An unknown code is almost always a product the shop has but has never scanned. */}
              {!learning && looksLikeBarcode(query) ? (
                <Button
                  label="Save this barcode to a product"
                  variant="outline"
                  icon="barcode-outline"
                  onPress={() => {
                    setLearning(query.trim().toUpperCase());
                    setQuery('');
                    searchBox.current?.focus();
                  }}
                  fullWidth
                />
              ) : null}
            </View>
          ) : (
            matches.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => (learning ? learn(item) : add(item))}
                style={styles.result}
              >
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
            {/* After a sale the till is not waiting for a first item, it is waiting for a
                customer. Saying "scan the first item" there reads like nothing was recorded. */}
            <Text style={[text.label, styles.muted]}>
              {lastBill ? 'Ready for the next customer' : 'Scan the first item'}
            </Text>

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

        {payment === 'cash' && lines.length > 0 ? (
          <View style={styles.row}>
            {/* The note a customer most often hands over, and "exact" for the rest. */}
            <Pressable onPress={() => setCashGiven(String(total))} style={styles.quick}>
              <Text style={text.label}>Exact</Text>
            </Pressable>
            {[500, 1000, 5000]
              .filter((note) => note >= total)
              .slice(0, 3)
              .map((note) => (
                <Pressable key={note} onPress={() => setCashGiven(String(note))} style={styles.quick}>
                  <Text style={text.label}>{note}</Text>
                </Pressable>
              ))}
          </View>
        ) : null}

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
        {tendered > 0 ? (
          <View style={styles.totals}>
            <Text style={[text.label, styles.muted]}>Change</Text>
            <Text style={[text.bodyStrong, { color: colors.success }]}>{currency(changeDue)}</Text>
          </View>
        ) : null}
        {shortOfCash && lines.length > 0 ? (
          <Text style={[text.caption, { color: colors.textMuted }]}>
            Enter what the customer handed over to finish this sale.
          </Text>
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
            onPress={finishPressed}
            disabled={!canFinish}
            style={styles.flexTwo}
          />
        </View>
      </View>
      {/* The one thing still worth a PIN: a discount above the shop's limit, while a cashier
          is at the counter. shopId, not profile.id -- a cashier's own id would salt a hash the
          owner's PIN could never match. */}
      <OwnerPin
        visible={approving !== null}
        shopId={shopId ?? ''}
        reason={`A discount of ${currency(discountValue)} is above the limit.`}
        onCancel={() => setApproving(null)}
        onApproved={() => {
          setApproving(null);
          void finish();
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  status: { alignItems: 'flex-end', gap: 2 },
  link: { alignItems: 'center', gap: 2 },
  lastAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  lastBill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successBg,
  },
  flex: { flex: 1 },
  flexTwo: { flex: 2 },
  muted: { color: colors.textMuted },
  noMatch: { padding: spacing.md, gap: spacing.md },
  learning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
  },
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
  quick: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
  },
  totals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
