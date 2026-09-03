/**
 * Supplier listings
 * 
 * Purpose : What this supplier sells, which is what customers search and order from. Includes the low-availability warning spec 10.1 asks for, so a supplier knows when to restock themselves.
 * Spec    : Section 10.1
 * Look here when : Listings render wrongly.
 */

import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { Input } from '../../../src/components/ui/Input';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { elevation, radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, quantity } from '../../../src/lib/format';
import { useAsync } from '../../../src/hooks/useAsync';
import { listListings } from '../../../src/api/listings';

export default function Listings() {
  const listings = useAsync(() => listListings(), []);
  const [query, setQuery] = useState('');

  const all = listings.data ?? [];
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((l) => l.product.name.toLowerCase().includes(q)) : all;
  const lowCount = all.filter((l) => l.is_low && l.is_active).length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={listings.refreshing} onRefresh={listings.refresh} />}
      >
        <ErrorBanner message={listings.error} />

        {lowCount > 0 ? (
          <ErrorBanner
            tone="warning"
            message={
              lowCount === 1
                ? 'One of your listings is running low. Customers cannot order what you do not hold.'
                : lowCount + ' of your listings are running low. Customers cannot order what you do not hold.'
            }
          />
        ) : null}

        {all.length === 0 && !listings.loading ? (
          <EmptyState
            icon="pricetags-outline"
            title="You are not selling anything yet"
            message="Add what you stock, with your price and how quickly you can deliver. Customers can only find you through your listings."
            actionLabel="Add your first listing"
            onAction={() => router.push('/(supplier)/listings/add')}
          />
        ) : (
          <>
            <Input value={query} onChangeText={setQuery} placeholder="Search your listings" icon="search" containerStyle={styles.search} />
            {shown.map((l) => (
              <Card
                key={l.id}
                onPress={() => router.push(`/(supplier)/listings/${l.id}`)}
                style={styles.card}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>{l.product.name}</Text>
                    <Text style={[text.caption, styles.muted]}>
                      {l.product.pack_size} · min {l.min_order_quantity} · {l.lead_time_days} day lead
                    </Text>
                  </View>
                  <View style={styles.right}>
                    <Text style={text.bodyStrong}>{currency(l.unit_price)}</Text>
                    <Text style={[text.caption, styles.muted]}>
                      {quantity(l.quantity_available)} available
                    </Text>
                  </View>
                </View>
                <View style={styles.badges}>
                  {!l.is_active ? <Badge label="Not selling" tone="neutral" /> : null}
                  {l.is_low && l.is_active ? <Badge label="Running low" tone="warning" /> : null}
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <Pressable
        style={[styles.fab, elevation(3)]}
        onPress={() => router.push('/(supplier)/listings/add')}
        accessibilityLabel="Add listing"
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  search: { marginBottom: spacing.md },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end' },
  muted: { color: colors.textMuted },
  badges: { flexDirection: 'row', gap: spacing.sm },
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
