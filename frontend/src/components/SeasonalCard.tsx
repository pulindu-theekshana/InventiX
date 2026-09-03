/**
 * Seasonal warning card
 * 
 * Purpose : One festival, weeks away, affected categories, and the shop products in them.
 * Spec    : Section 6.2
 * Look here when : A card shows the wrong products or timing.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import type { SeasonalWarning } from '../types/api';

interface Props {
  warning: SeasonalWarning;
  /**
   * Spec 6.2: tapping a product opens the restock popup pre-filled with the seasonal
   * quantity, not the normal restock quantity.
   */
  onProduct: (stockItemId: string, suggestedQuantity: number) => void;
}

export function SeasonalCard({ warning, onProduct }: Props) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconRing}>
          <Ionicons name="sparkles" size={18} color={colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={text.title}>{warning.name}</Text>
          <Text style={[text.caption, styles.muted]}>
            {warning.weeks_away} weeks away · {warning.affected_categories.join(', ')}
          </Text>
        </View>
      </View>

      <Text style={[text.label, styles.lead]}>
        These usually sell faster around {warning.name}. Suggested quantities allow for the
        expected increase.
      </Text>

      <View style={styles.products}>
        {warning.products.map((p) => (
          <Pressable
            key={p.stock_item_id}
            onPress={() => onProduct(p.stock_item_id, p.suggested_quantity)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.product, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.productText}>
              <Text style={text.bodyStrong} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[text.caption, styles.muted]}>{p.pack_size}</Text>
            </View>
            <View style={styles.suggest}>
              <Text style={[text.label, { color: colors.accent }]}>Order {p.suggested_quantity}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.accent} />
            </View>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  lead: { color: colors.textMuted },
  products: { gap: spacing.sm },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  productText: { flex: 1, gap: 2 },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
