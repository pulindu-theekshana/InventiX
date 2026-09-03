/**
 * Order card
 * 
 * Purpose : Used by both roles with different fields. Supplier or customer name, products, date, stage.
 * Spec    : Section 8.2 and 10.2
 * Look here when : A card shows a wrong or missing field.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { StageProgress } from './StageProgress';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { currencyShort, date, quantity } from '../lib/format';
import { STAGE } from '../constants/stages';
import type { OrderSummary } from '../types/api';

function toneFor(status: OrderSummary['status']) {
  if (status === 'rejected') return 'danger' as const;
  if (status === 'requested') return 'warning' as const;
  if (status === 'purchased' || status === 'confirmed') return 'success' as const;
  if (status === 'cancelled') return 'neutral' as const;
  return 'info' as const;
}

interface Props {
  order: OrderSummary;
  onPress: () => void;
  /** Hides the pipeline bar in sections where every row is at the same stage. */
  showProgress?: boolean;
  /** Slot for the supplier's stage-advance button, spec 10.3. */
  action?: React.ReactNode;
}

export function OrderCard({ order, onPress, showProgress = true, action }: Props) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={text.bodyStrong}>{order.reference}</Text>
          <Text style={[text.caption, styles.muted]} numberOfLines={1}>
            {order.counterparty_name}
            {order.counterparty_city ? ' · ' + order.counterparty_city : ''}
          </Text>
        </View>
        <Badge label={STAGE[order.status].label} tone={toneFor(order.status)} />
      </View>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSubtle} />
          <Text style={[text.caption, styles.muted]}>{date(order.requested_at)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="cube-outline" size={14} color={colors.textSubtle} />
          <Text style={[text.caption, styles.muted]}>
            {order.item_count} items · {quantity(order.total_quantity)} units
          </Text>
        </View>
        <Text style={text.bodyStrong}>{currencyShort(order.total_value)}</Text>
      </View>

      {showProgress ? <StageProgress status={order.status} compact /> : null}

      {order.rejection_reason ? (
        <Text style={[text.caption, { color: colors.danger }]}>{order.rejection_reason}</Text>
      ) : null}

      {order.requested_delivery_date && order.status !== 'purchased' ? (
        <View style={styles.eta}>
          <Ionicons name="time-outline" size={14} color={colors.success} />
          <Text style={[text.caption, { color: colors.success }]}>
            Wanted by {date(order.requested_delivery_date)}
          </Text>
        </View>
      ) : null}

      {/* Spec 11.3: delivered is a claim, not a status. The order stays on_the_way. */}
      {order.supplier_marked_delivered_at && order.status === 'on_the_way' ? (
        <View style={styles.eta}>
          <Ionicons name="checkmark-done" size={14} color={colors.info} />
          <Text style={[text.caption, { color: colors.info }]}>
            Supplier says delivered — confirm receipt to complete
          </Text>
        </View>
      ) : null}

      {action ? <View style={styles.action}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  action: { marginTop: spacing.xs },
});
