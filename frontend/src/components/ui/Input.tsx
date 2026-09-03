/**
 * Input
 * 
 * Purpose : Shared text input.
 * Spec    : -
 * Look here when : Inputs look inconsistent.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily, fontSize, text } from '../../theme/typography';

interface Props extends TextInputProps {
  label?: string;
  /** Shown in danger colour under the field. Spec 6.5: never fail without an explanation. */
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ label, error, hint, icon, containerStyle, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? <Text style={[text.label, styles.label]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.accent },
          error ? { borderColor: colors.danger } : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.textSubtle} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {error ? <Text style={[text.caption, styles.error]}>{error}</Text> : null}
      {!error && hint ? <Text style={[text.caption, styles.hint]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
  },
  input: {
    flex: 1,
    fontFamily,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  error: { color: colors.danger, marginTop: spacing.xs },
  hint: { color: colors.textSubtle, marginTop: spacing.xs },
});
