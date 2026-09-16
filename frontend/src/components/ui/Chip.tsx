/**
 * Chip
 *
 * Purpose : A small pill that is either selected or not. Category filters and pickers.
 * Look here when : A chip does not show its selected state.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { text } from '../../theme/typography';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[text.caption, { color: selected ? colors.onAccent : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  chipOn: { backgroundColor: colors.accent },
  chipOff: { backgroundColor: colors.surfaceMuted },
});
