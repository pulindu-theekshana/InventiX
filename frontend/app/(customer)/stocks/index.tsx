/**
 * Stocks home
 * 
 * Purpose : One scrolling screen, as spec 6.1 describes it: smart dashboard, then In stock, then Low stock. Not tabs. A floating button adds a product and the header offers the sales upload.
 * Spec    : Section 6.1
 * Look here when : The home screen renders wrongly.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StockStatusChart } from '../../../src/components/StockStatusChart';
import { SeasonalCard } from '../../../src/components/SeasonalCard';
import { StockRow } from '../../../src/components/StockRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Input } from '../../../src/components/ui/Input';
import { Card } from '../../../src/components/ui/Card';
import { colors } from '../../../src/theme/colors';
import { elevation, radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useSeasonalWarnings, useStockSummary, useStocks } from '../../../src/hooks/useStocks';
import { useSuppliers } from '../../../src/hooks/useSuppliers';
import { generateMessage } from '../../../src/api/ordering';
import { useMockData, MOCK_NOTICE } from '../../../src/api/client';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { StockItemView, StockStatus } from '../../../src/types/api';

export default function StocksHome() {
  const stocks = useStocks();
  const summary = useStockSummary();
  const seasonal = useSeasonalWarnings();
  const suppliers = useSuppliers('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockStatus | null>(null);

  const items = stocks.data ?? [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!q || i.product.name.toLowerCase().includes(q)) &&
        (filter === null || i.status === filter),
    );
  }, [items, query, filter]);

  const low = visible.filter((i) => i.status !== 'in_stock');
  const inStock = visible.filter((i) => i.status === 'in_stock');

  /**
   * Spec 6.4 — when several low items share a preferred supplier, offer one grouped order
   * rather than making the owner send three separate messages to the same person.
   */
  const groups = useMemo(() => {
    const map = new Map<string, StockItemView[]>();
    for (const item of low) {
      if (item.status !== 'low_stock' || !item.preferred_supplier_name) continue;
      const list = map.get(item.preferred_supplier_name) ?? [];
      list.push(item);
      map.set(item.preferred_supplier_name, list);
    }
    return [...map.entries()].filter(([, list]) => list.length > 1);
  }, [low]);

  /** The stock figures move once an order is sent, so refresh on the way back. */
  useFocusEffect(
    useCallback(() => {
      if (!draftStore.getDraft()) {
        stocks.refresh();
        summary.refresh();
      }
    }, []),
  );

  async function openRestock(chosen: StockItemView[], suggestedQuantity?: number) {
    const supplierName = chosen[0]?.preferred_supplier_name ?? null;
    const supplier = (suppliers.data ?? []).find((s) => s.business_name === supplierName) ?? null;
    const lines = chosen.map((item) => ({
      stock_item_id: item.id,
      catalog_product_id: item.product.id,
      name: item.product.name,
      pack_size: item.product.pack_size,
      quantity_requested: suggestedQuantity ?? Math.max(item.low_threshold * 2 - item.quantity_on_hand, 1),
      quantity_available: supplier?.listing?.quantity_available ?? null,
      min_order_quantity: supplier?.listing?.min_order_quantity ?? null,
      unit_price: item.unit_price,
    }));
    const { message_body, warnings } = await generateMessage(lines, supplier);
    draftStore.openDraft(lines, supplier, message_body, warnings);
    router.push('/(customer)/stocks/restock');
  }

  const loading = stocks.loading || summary.loading;
  const empty = !loading && items.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={stocks.refreshing}
            onRefresh={() => {
              stocks.refresh();
              summary.refresh();
              seasonal.refresh();
            }}
          />
        }
      >
        {useMockData ? <ErrorBanner message={MOCK_NOTICE} tone="info" /> : null}
        <ErrorBanner message={stocks.error} />

        {empty ? (
          <EmptyState
            icon="basket-outline"
            title="Your shop has no products yet"
            message="Add what you carry, or upload a sales report to bring your whole list in at once."
            actionLabel="Add a product"
            onAction={() => router.push('/(customer)/stocks/add')}
            secondaryLabel="Upload a sales report"
            onSecondary={() => router.push('/(customer)/stocks/upload')}
          />
        ) : (
          <>
            {/* Spec 6.2 — the smart dashboard sits at the top of this same screen. */}
            {(seasonal.data ?? []).map((w) => (
              <SeasonalCard
                key={w.id}
                warning={w}
                onProduct={(stockItemId, qty) => {
                  const item = items.find((i) => i.id === stockItemId);
                  if (item) openRestock([item], qty);
                }}
              />
            ))}

            {summary.data ? (
              <StockStatusChart summary={summary.data} selected={filter} onSelect={setFilter} />
            ) : null}

            {/*
              Spec 6.6. The only other way in was the empty state, which disappears as soon
              as a shop has products -- so the feature became unreachable for every shop
              that could actually use it.
            */}
            <Card onPress={() => router.push('/(customer)/stocks/upload')} style={styles.uploadRow}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.accent} />
              <Text style={[text.label, styles.flex, { color: colors.accent }]}>
                Upload a sales report
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </Card>

            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search products"
              icon="search"
              containerStyle={styles.search}
            />

            {/* Spec 6.4 — Low stock first, because it is the section that needs action. */}
            <Section title="Low stock" count={low.length} tone={colors.warning} />

            {groups.map(([supplierName, list]) => (
              <Card key={supplierName} onPress={() => openRestock(list)} style={styles.group}>
                <View style={styles.groupRow}>
                  <Ionicons name="albums-outline" size={20} color={colors.accent} />
                  <Text style={[text.bodyStrong, styles.flex]}>
                    Order {list.length} items from {supplierName}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.accent} />
                </View>
              </Card>
            ))}

            {low.length === 0 ? (
              <Text style={[text.label, styles.none]}>Nothing is low. </Text>
            ) : (
              low.map((item) => (
                <StockRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push(`/(customer)/stocks/${item.id}`)}
                  onRestock={() => openRestock([item])}
                />
              ))
            )}

            <Section title="In stock" count={inStock.length} tone={colors.success} />
            {inStock.map((item) => (
              <StockRow
                key={item.id}
                item={item}
                onPress={() => router.push(`/(customer)/stocks/${item.id}`)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Spec 6.1 — a floating action button for Add product. */}
      <Pressable
        style={[styles.fab, elevation(3)]}
        onPress={() => router.push('/(customer)/stocks/add')}
        accessibilityLabel="Add product"
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>

    </View>
  );
}

function Section({ title, count, tone }: { title: string; count: number; tone: string }) {
  return (
    <View style={styles.section}>
      <View style={[styles.sectionDot, { backgroundColor: tone }]} />
      <Text style={text.h2}>{title}</Text>
      <Text style={[text.label, styles.count]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  search: { marginBottom: spacing.lg },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  count: { color: colors.textSubtle },
  none: { color: colors.textSubtle, marginBottom: spacing.lg },
  group: { marginBottom: spacing.md, backgroundColor: colors.primaryTint },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
