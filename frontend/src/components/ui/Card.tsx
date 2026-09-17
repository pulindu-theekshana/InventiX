/**
 * Card
 * 
 * Purpose : Shared card container used by every feed list.
 * Spec    : -
 * Look here when : Cards look inconsistent.
 */

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { elevation, radius, spacing } from '../../theme/spacing';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** 0 flattens the card, for rows inside an already-elevated container. */
  level?: 0 | 1 | 2;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, onLongPress, level = 1, padded = true, style }: Props) {
  const body = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: colors.surface },
    elevation(level),
    style,
  ];

  if (!onPress) return <View style={body}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      style={({ pressed }) => [...body, pressed && { opacity: 0.9 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: spacing.lg },
});
