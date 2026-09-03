/**
 * Suppliers feed
 * 
 * Purpose : Browse mode from the tab bar, selection mode from the restock popup. The Company and Product tabs are the two search types spec 9.1 defines. Order comes from the backend ranking, never from the app.
 * Spec    : Section 9.1 and 9.3
 * Look here when : Suppliers are ordered wrongly or selection mode misbehaves.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SupplierRow } from '../../../src/components/SupplierRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Input } from '../../../src/components/ui/Input';
import { Card } from '../../../src/components/ui/Card';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useSuppliers } from '../../../src/hooks/useSuppliers';

type Mode = 'company' | 'product';

export default function SuppliersFeed() {
  const { select } = useLocalSearchParams<{ select?: string }>();
  const selectionMode = select === '1';
  const [mode, setMode] = useState<Mode>(selectionMode ? 'product' : 'company');
  const [query, setQuery] = useState('');
  const suppliers = useSuppliers(query);

  const list = suppliers.data ?? [];

  return (
    <View style={styles.root}>
      {selectionMode ? (
        <Card style={styles.banner}>
          <Ionicons name="information-circle" size={18} color={colors.info} />
          <Text style={[text.label, styles.flex]}>
            Choose a supplier for this order. The message is rewritten for whoever you pick.
          </Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        <Pressable onPress={() => setMode('company')} style={[styles.tab, mode === 'company' && styles.tabActive]}>
          <Text style={[text.bodyStrong, { color: mode === 'company' ? colors.accent : colors.textMuted }]}>
            Company
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode('product')} style={[styles.tab, mode === 'product' && styles.tabActive]}>
          <Text style={[text.bodyStrong, { color: mode === 'product' ? colors.accent : colors.textMuted }]}>
            Product
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'company' ? 'Search company names' : 'Search for a product'}
          icon="search"
        />
        {mode === 'product' ? (
          <Text style={[text.caption, styles.hint]}>
            Results are the suppliers who stock it, best ranked first.
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={suppliers.refreshing} onRefresh={suppliers.refresh} />}
      >
        <ErrorBanner message={suppliers.error} />
        {list.length === 0 && !suppliers.loading ? (
          <EmptyState
            icon="people-outline"
            title="No suppliers match"
            message="Try a shorter search, or switch between Company and Product."
          />
        ) : (
          list.map((s, i) => (
            <SupplierRow
              key={s.id}
              supplier={s}
              rank={mode === 'product' ? i + 1 : undefined}
              selectionMode={selectionMode}
              onPress={() =>
                selectionMode
                  ? router.back()
                  : router.push(`/(customer)/suppliers/${s.id}`)
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoBg,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.md,
  },
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
  scroll: { padding: spacing.lg, paddingTop: spacing.sm },
});
