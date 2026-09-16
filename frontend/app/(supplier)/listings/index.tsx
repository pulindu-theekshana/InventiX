/**
 * Supplier listings
 * 
 * Purpose : What this supplier sells, which is what customers search and order from. Includes the low-availability warning spec 10.1 asks for, so a supplier knows when to restock themselves.
 * Spec    : Section 10.1
 * Look here when : Listings render wrongly.
 */

import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { Input } from '../../../src/components/ui/Input';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { elevation, radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, initials, quantity, rating } from '../../../src/lib/format';
import { useAsync } from '../../../src/hooks/useAsync';
import { listListings } from '../../../src/api/listings';
import { getOverview } from '../../../src/api/overview';

export default function Listings() {
  const listings = useAsync(() => listListings(), []);
  /** Spec 10.1 — the supplier's own dashboard, the mirror of the shop's stock overview. */
  const overview = useAsync(() => getOverview(), []);
  const [query, setQuery] = useState('');

  /**
   * Adding, editing or retiring a listing all return here, and the list would otherwise
   * still show what it fetched on the way out — so a product just added looks like it was
   * never saved. Refetching on focus is what makes the new row appear without a pull.
   */
  useFocusEffect(
    useCallback(() => {
      listings.refresh();
      overview.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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

        {overview.data ? (
          <Card style={[styles.profile, elevation(1)]}>
            <View style={styles.profileHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(overview.data.business_name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={text.h2}>{overview.data.business_name}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {overview.data.city ?? 'No city set'} · {overview.data.active_listings} products
                </Text>
              </View>
              {overview.data.is_new_supplier ? <Badge label="New supplier" tone="info" /> : null}
            </View>

            <View style={styles.figures}>
              <Figure
                icon="star"
                tint={colors.warning}
                value={
                  overview.data.average_rating === null
                    ? '--'
                    : rating(overview.data.average_rating)
                }
                caption={
                  overview.data.rating_count === 1
                    ? '1 rating'
                    : overview.data.rating_count + ' ratings'
                }
              />
              <Figure
                icon="mail-unread"
                tint={colors.accent}
                value={String(overview.data.pending_orders)}
                caption="awaiting reply"
              />
              <Figure
                icon="checkmark-done"
                tint={colors.success}
                value={String(overview.data.completed_orders)}
                caption="completed"
              />
            </View>

            {overview.data.top_customers.length > 0 ? (
              <View style={styles.customers}>
                <Text style={[text.label, styles.muted]}>Your best customers</Text>
                {overview.data.top_customers.map((c) => (
                  <View key={c.name} style={styles.customerRow}>
                    <Text style={[text.body, styles.flex]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[text.caption, styles.muted]}>
                      {c.orders === 1 ? '1 order' : c.orders + ' orders'}
                    </Text>
                    <Text style={text.bodyStrong}>{currency(c.total_value)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[text.caption, styles.muted]}>
                No completed orders yet. Your best customers will appear here.
              </Text>
            )}
          </Card>
        ) : null}

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

function Figure({
  icon,
  tint,
  value,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.figure}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={text.bodyStrong}>{value}</Text>
      <Text style={[text.caption, styles.muted]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { gap: spacing.md },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...text.bodyStrong, color: colors.onAccent },
  figures: { flexDirection: 'row', gap: spacing.md },
  figure: { flex: 1, alignItems: 'center', gap: 2 },
  customers: { gap: spacing.sm },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
