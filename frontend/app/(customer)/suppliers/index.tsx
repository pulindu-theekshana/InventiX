/**
 * Suppliers feed
 *
 * Purpose : Browsing suppliers from the tab bar. The Company and Product tabs are the two search types spec 9.1 defines.
 * Product search is also how a shop orders a product it has never stocked: pick the product, tap a supplier to
 * select it and confirm, or hold a supplier to see its details. Those results are sorted best rated first.
 * Choosing a supplier for an existing restock is a separate screen, restock/supplier.tsx.
 * Spec    : Section 9.1 and 9.3
 * Look here when : Suppliers are ordered wrongly, or ordering a new product misbehaves.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SupplierRow } from '../../../src/components/SupplierRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Input } from '../../../src/components/ui/Input';
import { Card } from '../../../src/components/ui/Card';
import { Modal } from '../../../src/components/ui/Modal';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, quantity, rating } from '../../../src/lib/format';
import { useAsync } from '../../../src/hooks/useAsync';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { useSuppliers, useSuppliersForProduct } from '../../../src/hooks/useSuppliers';
import { searchCatalog } from '../../../src/api/catalog';
import { generateMessage } from '../../../src/api/ordering';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { RestockLine, SupplierView } from '../../../src/types/api';
import type { CatalogProduct } from '../../../src/types/database';

type Mode = 'company' | 'product';

/** Best rated first, unrated last. Sort is stable, so ties keep the backend's ranking order. */
function byRating(list: SupplierView[]): SupplierView[] {
  return [...list].sort((a, b) => (b.average_rating ?? -1) - (a.average_rating ?? -1));
}

export default function SuppliersFeed() {
  const [mode, setMode] = useState<Mode>('company');
  const [query, setQuery] = useState('');
  const suppliers = useSuppliers(query);

  // Product search: pick a product, then the suppliers who sell it.
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const products = useAsync(
    () => (mode === 'product' ? searchCatalog(query) : Promise.resolve([])),
    [mode, query],
  );
  const sellers = useSuppliersForProduct(product?.id ?? null);
  /** Tapped: outlined, and the order confirmation opens for it. */
  const [selected, setSelected] = useState<SupplierView | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** Held down: its basic details, until the popup is dismissed. */
  const [peek, setPeek] = useState<SupplierView | null>(null);
  const submit = useSubmit();

  const list = suppliers.data ?? [];
  const productList = products.data ?? [];
  const sellerList = byRating(sellers.data ?? []);
  const active = mode === 'company' ? suppliers : product ? sellers : products;

  function switchMode(next: Mode) {
    setMode(next);
    choose(null);
  }

  function search(value: string) {
    setQuery(value);
    choose(null);
  }

  function choose(next: CatalogProduct | null) {
    setProduct(next);
    setSelected(null);
  }

  function select(supplier: SupplierView) {
    setSelected(supplier);
    setConfirming(true);
  }

  /**
   * Opens the same request screen a low stock product does. The line has no stock item,
   * so the backend writes it as a first order, and the product only joins the Stocks feed
   * once the customer confirms receipt.
   */
  async function orderNewProduct() {
    if (!product || !selected) return;
    const supplier = selected;
    const ok = await submit.run(async () => {
      const line: RestockLine = {
        stock_item_id: null,
        catalog_product_id: product.id,
        name: product.name,
        pack_size: product.pack_size,
        // The supplier's minimum is the least that can be sent.
        quantity_requested: Math.max(supplier.listing?.min_order_quantity ?? 1, 1),
        quantity_available: supplier.listing?.quantity_available ?? null,
        min_order_quantity: supplier.listing?.min_order_quantity ?? null,
        unit_price: supplier.listing?.unit_price ?? null,
      };
      const { message_body, warnings, duplicates } = await generateMessage([line], supplier);
      // Already on an open order with this supplier: listed on the request screen before
      // Send, and the owner has just confirmed they want to order it.
      draftStore.openDraft([line], supplier, message_body, [...warnings, ...duplicates], duplicates.length > 0);
    });
    if (ok) {
      setConfirming(false);
      router.push('/(customer)/restock' as never);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Pressable onPress={() => switchMode('company')} style={[styles.tab, mode === 'company' && styles.tabActive]}>
          <Text style={[text.bodyStrong, { color: mode === 'company' ? colors.accent : colors.textMuted }]}>
            Company
          </Text>
        </Pressable>
        <Pressable onPress={() => switchMode('product')} style={[styles.tab, mode === 'product' && styles.tabActive]}>
          <Text style={[text.bodyStrong, { color: mode === 'product' ? colors.accent : colors.textMuted }]}>
            Product
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Input
          value={query}
          onChangeText={search}
          placeholder={mode === 'company' ? 'Search company names' : 'Search for a product'}
          icon="search"
        />
        {mode === 'product' ? (
          <Text style={[text.caption, styles.hint]}>
            {product
              ? 'Best rated first. Tap a supplier to order, hold to see their details.'
              : 'Pick a product to see the suppliers who sell it.'}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={active.refreshing} onRefresh={active.refresh} />}
      >
        <ErrorBanner message={active.error} />
        {mode === 'company' ? (
          list.length === 0 && !suppliers.loading ? (
            <EmptyState
              icon="people-outline"
              title="No suppliers match"
              message="Try a shorter search, or switch between Company and Product."
            />
          ) : (
            list.map((s) => (
              <SupplierRow
                key={s.id}
                supplier={s}
                onPress={() => router.push(`/(customer)/suppliers/${s.id}`)}
              />
            ))
          )
        ) : !product ? (
          productList.length === 0 && !products.loading ? (
            <EmptyState
              icon="search-outline"
              title="No product matches"
              message="Try a shorter search, or check the spelling."
            />
          ) : (
            productList.map((p) => (
              <Card key={p.id} onPress={() => choose(p)} style={styles.result}>
                <View style={styles.resultRow}>
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>{p.name}</Text>
                    <Text style={[text.caption, styles.muted]}>
                      {p.pack_size} · {p.category}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
                </View>
              </Card>
            ))
          )
        ) : (
          <>
            <Card style={styles.result}>
              <View style={styles.resultRow}>
                <View style={styles.flex}>
                  <Text style={[text.caption, styles.muted]}>Suppliers who sell</Text>
                  <Text style={text.bodyStrong}>
                    {product.name} {product.pack_size}
                  </Text>
                </View>
                <Pressable onPress={() => choose(null)} hitSlop={8}>
                  <Text style={[text.label, { color: colors.accent }]}>Change</Text>
                </Pressable>
              </View>
            </Card>
            {sellerList.length === 0 && !sellers.loading ? (
              <EmptyState
                icon="people-outline"
                title="No supplier sells this yet"
                message="Nobody on InventiX lists this product. Try a similar one."
              />
            ) : (
              sellerList.map((s, i) => (
                <SupplierRow
                  key={s.id}
                  supplier={s}
                  rank={i + 1}
                  selected={selected?.id === s.id}
                  onPress={() => select(s)}
                  onLongPress={() => setPeek(s)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Held down: basic details. Tapping outside closes it and leaves the list as it was. */}
      <Modal visible={peek !== null} onClose={() => setPeek(null)} variant="dialog" title={peek?.business_name}>
        {peek ? (
          <View style={styles.details}>
            {peek.is_new_supplier ? <Badge label="New supplier" tone="info" /> : null}
            <Detail icon="location-outline" label="City" value={peek.city ?? 'Sri Lanka'} />
            <Detail
              icon="star"
              label="Rating"
              value={
                peek.average_rating === null
                  ? 'No ratings yet'
                  : rating(peek.average_rating) + ' from ' + peek.rating_count + ' ratings'
              }
            />
            <Detail
              icon="time-outline"
              label="Delivery"
              value={
                peek.measured_delivery_days === null
                  ? 'Not measured yet'
                  : peek.measured_delivery_days.toFixed(1) + ' days on average'
              }
            />
            {peek.listing ? (
              <>
                <Detail icon="pricetag-outline" label="Price" value={currency(peek.listing.unit_price)} />
                <Detail
                  icon="cube-outline"
                  label="Available"
                  value={quantity(peek.listing.quantity_available) + ', min ' + peek.listing.min_order_quantity}
                />
                <Detail icon="car-outline" label="Lead time" value={peek.listing.lead_time_days + ' days'} />
              </>
            ) : null}
          </View>
        ) : null}
      </Modal>

      {/* Tapped: confirm before building the request. */}
      <Modal
        visible={confirming}
        onClose={() => setConfirming(false)}
        variant="dialog"
        title="Order new product"
        footer={
          <View style={styles.footerRow}>
            <Button label="Cancel" variant="outline" onPress={() => setConfirming(false)} style={styles.flex} />
            <Button
              label="Order New Product"
              variant="accent"
              loading={submit.busy}
              onPress={orderNewProduct}
              style={styles.flex}
            />
          </View>
        }
      >
        <ErrorBanner message={submit.error} />
        <Text style={text.body}>
          Order {product?.name} {product?.pack_size} from {selected?.business_name}?
        </Text>
      </Modal>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={[text.label, styles.muted, styles.detailLabel]}>{label}</Text>
      <Text style={[text.body, styles.flex]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  hint: { color: colors.textSubtle },
  muted: { color: colors.textMuted },
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
  result: { marginBottom: spacing.sm, borderRadius: radius.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  details: { gap: spacing.md },
  detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailLabel: { width: 72 },
  footerRow: { flexDirection: 'row', gap: spacing.md },
});
