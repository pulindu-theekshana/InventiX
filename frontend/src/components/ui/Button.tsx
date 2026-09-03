/**
 * Button
 * 
 * Purpose : Shared button with the brand colours and disabled state.
 * Spec    : -
 * Look here when : Buttons look inconsistent.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { text } from '../../theme/typography';

type Variant = 'primary' | 'accent' | 'send' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon after the label instead of before, for Send. */
  iconRight?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FILL: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  accent: { bg: colors.accent, fg: colors.onAccent },
  send: { bg: colors.send, fg: colors.onAccent },
  danger: { bg: colors.danger, fg: colors.onAccent },
  outline: { bg: 'transparent', fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.accent },
};

const HEIGHT: Record<Size, number> = { sm: 36, md: 44, lg: 52 };

export function Button({
  label,
  onPress,
  variant = 'accent',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconRight = false,
  fullWidth = false,
  style,
}: Props) {
  const fill = FILL[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: inactive ? colors.disabled : fill.bg,
          borderWidth: fill.border ? 1 : 0,
          borderColor: fill.border,
          opacity: pressed && !inactive ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={inactive ? colors.onDisabled : fill.fg} />
      ) : (
        <View style={styles.row}>
          {icon && !iconRight ? (
            <Ionicons name={icon} size={18} color={inactive ? colors.onDisabled : fill.fg} />
          ) : null}
          <Text
            style={[
              size === 'sm' ? text.label : text.bodyStrong,
              { color: inactive ? colors.onDisabled : fill.fg },
            ]}
          >
            {label}
          </Text>
          {icon && iconRight ? (
            <Ionicons name={icon} size={18} color={inactive ? colors.onDisabled : fill.fg} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
