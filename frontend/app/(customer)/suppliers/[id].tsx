/**
 * Supplier profile
 * 
 * Purpose : Everything spec 9.2 requires, plus the ranking score. The score covers the two context-free components only, quality rating and measured delivery speed; availability and price depend on what is being ordered, so they appear as raw listing figures instead.
 * Spec    : Section 9.2
 * Look here when : A profile field is missing.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currency, initials, quantity, rating } from '../../../src/lib/format';
import { useSupplier } from '../../../src/hooks/useSuppliers';

export default function SupplierProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const supplier = useSupplier(id);

  const s = supplier.data;
  if (supplier.loading) return <View style={styles.root} />;
  if (!s) return <ErrorBanner message="That supplier could not be found." />;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.head}>
        <View style={styles.headRow}>
          <View style={styles.avatar}>
            <Text style={[text.h2, { color: colors.onAccent }]}>{initials(s.business_name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={text.h2}>{s.business_name}</Text>
            <Text style={[text.label, styles.muted]}>{s.city ?? 'Sri Lanka'}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <Badge label={s.is_active ? 'Active' : 'Inactive'} tone={s.is_active ? 'success' : 'neutral'} />
          {s.is_new_supplier ? <Badge label="New supplier" tone="info" /> : null}
        </View>
      </Card>

      {/* The score, with the two things it is actually made of shown underneath it. */}
      <Card style={styles.gap}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreCircle}>
            <Text style={[text.display, { color: colors.accent }]}>{s.score ?? '—'}</Text>
            <Text style={[text.caption, styles.muted]}>out of 100</Text>
          </View>
          <View style={styles.flex}>
            <Metric
              icon="star"
              tint={colors.warning}
              value={s.average_rating === null ? 'No ratings yet' : rating(s.average_rating) + ' out of 5'}
              label={s.rating_count === 1 ? 'from 1 rating' : 'from ' + s.rating_count + ' ratings'}
            />
            <Metric
              icon="time-outline"
              tint={colors.info}
              value={
                s.measured_delivery_days === null
                  ? 'Not measured yet'
                  : s.measured_delivery_days.toFixed(1) + ' days'
              }
              label="measured from completed orders, not their claim"
            />
          </View>
        </View>
        {s.is_new_supplier ? (
          <Text style={[text.caption, styles.newNote]}>
            This supplier has fewer than three completed orders, so their score is provisional
            rather than earned.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Contact</Text>
        <Line icon="person-outline" value={s.contact_person} />
        <Line icon="call-outline" value={s.phone} />
        <Line icon="logo-whatsapp" value={s.whatsapp_number ?? 'Not given'} />
        <Line icon="mail-outline" value={s.email} />
        <Line icon="location-outline" value={s.address ?? 'Not given'} />
        <Line
          icon="navigate-outline"
          value={s.delivery_areas?.join(', ') ?? 'Delivery areas not given'}
        />
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>What they sell</Text>
        {s.listings.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>No active listings.</Text>
        ) : (
          s.listings.map((l) => (
            <View key={l.id} style={styles.listing}>
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{l.product.name}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {l.product.pack_size} · min {l.min_order_quantity} · {l.lead_time_days} day lead
                </Text>
              </View>
              <View style={styles.listingRight}>
                <Text style={text.bodyStrong}>{currency(l.unit_price)}</Text>
                <Text
                  style={[text.caption, { color: l.is_low ? colors.warning : colors.textMuted }]}
                >
                  {quantity(l.quantity_available)} available
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>Your orders with them</Text>
        {s.order_history.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>
            You have not ordered from this supplier yet.
          </Text>
        ) : (
          s.order_history.map((o) => (
            <View key={o.id} style={styles.listing}>
              <Text style={[text.label, styles.flex]}>{o.reference}</Text>
              <Text style={[text.caption, styles.muted]}>{currency(o.total_value)}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Metric({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color={tint} />
      <View style={styles.flex}>
        <Text style={text.bodyStrong}>{value}</Text>
        <Text style={[text.caption, styles.muted]}>{label}</Text>
      </View>
    </View>
  );
}

function Line({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textSubtle} />
      <Text style={[text.label, styles.flex]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  head: { gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badges: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  gap: { gap: spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  scoreCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metric: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  newNote: { color: colors.textSubtle },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  listingRight: { alignItems: 'flex-end' },
});
