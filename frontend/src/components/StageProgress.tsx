/**
 * Stage indicator
 * 
 * Purpose : Visual progress through the six visible stages.
 * Spec    : Section 11.1
 * Look here when : The indicator shows the wrong stage.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import { STAGE } from '../constants/stages';
import { PIPELINE, type OrderStatus } from '../types/orderStatus';

interface Props {
  status: OrderStatus;
  /** Compact hides the labels, for use inside a list card. */
  compact?: boolean;
}

export function StageProgress({ status, compact = false }: Props) {
  /**
   * rejected and cancelled are not on the pipeline, so there is no position to show.
   * Spec 11.2 makes both terminal, and the card shows the reason instead.
   */
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <View style={[styles.terminal, { backgroundColor: STAGE[status].bg }]}>
        <Text style={[text.caption, { color: STAGE[status].color }]}>
          {STAGE[status].label} — this order went no further.
        </Text>
      </View>
    );
  }

  const index = PIPELINE.indexOf(status);

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {PIPELINE.map((stage, i) => (
          <View
            key={stage}
            style={[
              styles.segment,
              { backgroundColor: i <= index ? colors.success : colors.border },
              i === 0 && styles.first,
              i === PIPELINE.length - 1 && styles.last,
            ]}
          />
        ))}
      </View>
      {!compact ? (
        <View style={styles.labels}>
          <Text style={[text.caption, { color: colors.success }]}>{STAGE[status].label}</Text>
          <Text style={[text.caption, { color: colors.textSubtle }]}>
            Step {index + 1} of {PIPELINE.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  track: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 5 },
  first: { borderTopLeftRadius: radius.pill, borderBottomLeftRadius: radius.pill },
  last: { borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  terminal: { padding: spacing.sm, borderRadius: radius.sm },
});
