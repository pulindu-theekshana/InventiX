/**
 * Supplier row
 * 
 * Purpose : Rating, price, availability, lead time, New supplier badge, and the cannot-meet-quantity marker.
 * Spec    : Section 9.3 and 12.2
 * Look here when : A supplier row is missing its badge or marker.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { currency, initials, quantity, rating } from '../lib/format';
import type { SupplierView } from '../types/api';

/** Deterministic avatar tint, so the same supplier keeps the same colour between screens. */
const AVATAR_TINTS = [colors.success, colors.info, colors.danger, colors.accent, colors.warning];
function tintFor(id: string) {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

interface Props {
  supplier: SupplierView;
  onPress: () => void;
  /** Position in the ranked list, 1-based. Spec 12 orders the list; this just labels it. */
  rank?: number;
  /** Selection mode from the restock popup, spec 9.3. */
  selectionMode?: boolean;
  /** Held down: the Suppliers feed shows the supplier's basic details. */
  onLongPress?: () => void;
  /** Outlined, for the supplier picked when ordering a new product. */
  selected?: boolean;
}

export function SupplierRow({ supplier, onPress, rank, selectionMode = false, onLongPress, selected = false }: Props) {
  const cannotMeet = selectionMode && supplier.can_meet_quantity === false;

  return (
    <Card
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, cannotMeet && styles.dimmed, selected && styles.selected]}
    >
      <View style={styles.header}>
        {rank !== undefined ? (
          <View style={styles.rank}>
            <Text style={[text.caption, styles.rankText]}>{rank}</Text>
          </View>
        ) : null}
        <View style={[styles.avatar, { backgroundColor: tintFor(supplier.id) }]}>
          <Text style={[text.bodyStrong, { color: colors.onAccent }]}>
            {initials(supplier.business_name)}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={text.bodyStrong} numberOfLines={1}>
            {supplier.business_name}
          </Text>
          <Text style={[text.caption, styles.muted]} numberOfLines={1}>
            {supplier.city ?? 'Sri Lanka'}
          </Text>
        </View>
        <View style={styles.badges}>
          {supplier.is_new_supplier ? <Badge label="New supplier" tone="info" /> : null}
          {!supplier.is_active ? <Badge label="Inactive" tone="neutral" /> : null}
        </View>
      </View>

      <View style={styles.stats}>
        <Stat
          icon="star"
          value={supplier.average_rating === null ? 'No ratings' : rating(supplier.average_rating)}
          caption={supplier.rating_count === 1 ? '1 rating' : supplier.rating_count + ' ratings'}
          tint={colors.warning}
        />
        <Stat
          icon="time-outline"
          value={
            supplier.measured_delivery_days === null
              ? 'Not measured'
              : supplier.measured_delivery_days.toFixed(1) + ' days'
          }
          caption="measured"
          tint={colors.info}
        />
        {supplier.score !== null ? (
          <Stat icon="trending-up" value={String(supplier.score)} caption="score" tint={colors.success} />
        ) : null}
      </View>

      {/* Spec 9.1 — a product search result carries the figures needed to compare. */}
      {supplier.listing ? (
        <View style={styles.listing}>
          <Text style={text.bodyStrong}>{currency(supplier.listing.unit_price)}</Text>
          <Text style={[text.caption, styles.muted]}>
            {quantity(supplier.listing.quantity_available)} available · min{' '}
            {supplier.listing.min_order_quantity} · {supplier.listing.lead_time_days} day lead
          </Text>
        </View>
      ) : null}

      {/* Spec 9.3 — shown but marked, never hidden, so the customer knows why it ranks lower. */}
      {cannotMeet ? (
        <View style={styles.warning}>
          <Ionicons name="alert-circle" size={15} color={colors.danger} />
          <Text style={[text.caption, { color: colors.danger }]}>
            Cannot supply the full quantity you asked for
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

function Stat({
  icon,
  value,
  caption,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  caption: string;
  tint: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={tint} />
      <View>
        <Text style={text.label}>{value}</Text>
        <Text style={[text.caption, styles.muted]}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  dimmed: { opacity: 0.72 },
  selected: { borderWidth: 2, borderColor: colors.accent },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rank: { width: 20, alignItems: 'center' },
  rankText: { color: colors.textSubtle },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  badges: { alignItems: 'flex-end', gap: spacing.xs },
  muted: { color: colors.textMuted },
  stats: { flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listing: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  warning: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
