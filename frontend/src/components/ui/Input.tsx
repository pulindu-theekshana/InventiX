/**
 * Input
 * 
 * Purpose : Shared text input. Carries the three border states the design asks for — grey at rest, blue while focused, red when the value breaks a rule — and lists every broken rule underneath in small red type.
 * Spec    : -
 * Look here when : Inputs look inconsistent, or a field shows the wrong border colour.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { fontFamily, fontSize, text } from '../../theme/typography';

interface Props extends TextInputProps {
  label?: string;
  /**
   * A single message, for fields that judge themselves inline (a password too short).
   * Fields with a rule set pass `errors` instead; both end up in the same list below.
   */
  error?: string | null;
  /** Every rule the value breaks, shown one per line. Spec 6.5: never fail without an explanation. */
  errors?: string[];
  /** Marks the label with a red asterisk, matching the design. */
  required?: boolean;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  errors,
  required,
  hint,
  icon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  /* One list whichever prop was used, so the border and the messages never disagree. */
  const messages = errors?.length ? errors : error ? [error] : [];
  const invalid = messages.length > 0;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[text.label, styles.label]}>
          {label}
          {required ? <Text style={styles.asterisk}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          /* Red outranks blue: a field the user is fixing should stay red while they type. */
          focused && !invalid ? { borderColor: colors.info } : null,
          invalid ? { borderColor: colors.danger } : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.textSubtle} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {invalid
        ? messages.map((message) => (
            <Text key={message} style={[text.caption, styles.error]}>
              {message}
            </Text>
          ))
        : null}
      {!invalid && hint ? <Text style={[text.caption, styles.hint]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, marginBottom: spacing.xs },
  asterisk: { color: colors.danger },
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
