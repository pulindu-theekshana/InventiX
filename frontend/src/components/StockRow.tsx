/**
 * Stock list row
 * 
 * Purpose : Product name, pack size, quantity, threshold, and the Requested badge that blocks double ordering.
 * Spec    : Section 6.3 and 6.4
 * Look here when : A requested item still opens the popup.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/Card';
import { Badge, type Tone } from './ui/Badge';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { currency, quantity } from '../lib/format';
import type { StockItemView } from '../types/api';

const LABEL: Record<StockItemView['status'], { label: string; tone: Tone }> = {
  in_stock: { label: 'In stock', tone: 'success' },
  low_stock: { label: 'Low stock', tone: 'warning' },
  restock_requested: { label: 'Requested', tone: 'info' },
};

interface Props {
  item: StockItemView;
  /** Opens the stock item detail. Always available. */
  onPress: () => void;
  /**
   * Opens the restock popup. Spec 6.4: a row already covered by an open order shows the
   * Requested badge and must NOT open the popup, which is what prevents double ordering.
   */
  onRestock?: () => void;
}

export function StockRow({ item, onPress, onRestock }: Props) {
  const meta = LABEL[item.status];
  const canRestock = item.status === 'low_stock' && onRestock;

  return (
    <Card onPress={canRestock ? onRestock : onPress} level={1} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={text.bodyStrong} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={[text.caption, styles.muted]}>
            {item.product.pack_size} · {item.product.category}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={text.bodyStrong}>{currency(item.unit_price)}</Text>
          <Text style={[text.caption, styles.muted]}>
            Stock: {quantity(item.quantity_on_hand)} / min {quantity(item.low_threshold)}
          </Text>
          <Badge label={meta.label} tone={meta.tone} />
        </View>
      </View>
      {item.status === 'low_stock' && item.preferred_supplier_name ? (
        <Text style={[text.caption, styles.supplier]} numberOfLines={1}>
          Usually from {item.preferred_supplier_name}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  left: { flex: 1, gap: spacing.xs },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  muted: { color: colors.textMuted },
  supplier: { color: colors.textSubtle, marginTop: spacing.md },
});
