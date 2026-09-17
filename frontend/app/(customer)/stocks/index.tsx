/**
 * Stocks home
 * 
 * Purpose : Smart dashboard, then Low stock and In stock as two tabs. Spec 6.1 has them as one scrolling list; tabs replaced it so a long In stock list no longer buries what needs ordering. A floating button adds a product.
 * Spec    : Section 6.1
 * Look here when : The home screen renders wrongly.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StockStatusChart } from '../../../src/components/StockStatusChart';
import { StockRow } from '../../../src/components/StockRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Input } from '../../../src/components/ui/Input';
import { Card } from '../../../src/components/ui/Card';
import { Tabs } from '../../../src/components/ui/Tabs';
import { colors } from '../../../src/theme/colors';
import { elevation, radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useSeasonalWarnings, useStockSummary, useStocks } from '../../../src/hooks/useStocks';
import { useOpenRestock } from '../../../src/hooks/useOpenRestock';
import { useMockData, MOCK_NOTICE } from '../../../src/api/client';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { StockItemView, StockStatus } from '../../../src/types/api';

export default function StocksHome() {
  const stocks = useStocks();
  const summary = useStockSummary();
  const seasonal = useSeasonalWarnings();
  const restock = useOpenRestock();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockStatus | null>(null);
  /** Low stock first: it is the tab that needs action. */
  const [tab, setTab] = useState<'low' | 'in'>('low');

  const items = stocks.data ?? [];
  /** The backend sends them soonest first. */
  const festivals = seasonal.data ?? [];
  const nextFestival = festivals[0];

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
        <ErrorBanner message={restock.error} />

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
            {/*
              Spec 6.2, folded to one line: a festival can touch a dozen products, and listing
              them all here pushed Low stock off the screen. The full list is one tap away.
            */}
            {nextFestival ? (
              <Card onPress={() => router.push('/(customer)/stocks/seasonal' as never)} style={styles.festival}>
                <View style={styles.festivalIcon}>
                  <Ionicons name="sparkles" size={18} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>
                    {nextFestival.name} in {nextFestival.weeks_away} {nextFestival.weeks_away === 1 ? 'week' : 'weeks'}
                  </Text>
                  <Text style={[text.caption, styles.muted]}>
                    {nextFestival.products.length} {nextFestival.products.length === 1 ? 'product' : 'products'} to prepare
                    {festivals.length > 1 ? ` · +${festivals.length - 1} more` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.accent} />
              </Card>
            ) : null}

            {summary.data ? (
              <StockStatusChart
                summary={summary.data}
                selected={filter}
                onSelect={(status) => {
                  setFilter(status);
                  // A slice's items live on one tab; show that tab rather than an empty one.
                  if (status) setTab(status === 'in_stock' ? 'in' : 'low');
                }}
              />
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

            <Tabs
              options={[
                { value: 'low', label: `Low stock (${low.length})` },
                { value: 'in', label: `In stock (${inStock.length})` },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'low' ? (
              <View style={styles.list}>
                {/* Spec 6.4 — one grouped order when several low items share a supplier. */}
                {groups.map(([supplierName, list]) => (
                  <Card key={supplierName} onPress={() => restock.open(list)} style={styles.group}>
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
                  <Text style={[text.label, styles.none]}>Nothing is low.</Text>
                ) : (
                  low.map((item) => (
                    <StockRow
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(customer)/stocks/${item.id}`)}
                      onRestock={() => restock.open([item])}
                    />
                  ))
                )}
              </View>
            ) : (
              <View style={styles.list}>
                {inStock.length === 0 ? (
                  <Text style={[text.label, styles.none]}>Nothing in stock matches.</Text>
                ) : (
                  inStock.map((item) => (
                    <StockRow
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(customer)/stocks/${item.id}`)}
                    />
                  ))
                )}
              </View>
            )}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  search: { marginBottom: spacing.lg },
  list: { paddingTop: spacing.md },
  none: { color: colors.textSubtle, marginBottom: spacing.lg },
  group: { marginBottom: spacing.md, backgroundColor: colors.primaryTint },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  festival: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  festivalIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
