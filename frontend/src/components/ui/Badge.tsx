/**
 * Badge
 * 
 * Purpose : Status badges: In stock, Low stock, Requested, New supplier.
 * Spec    : -
 * Look here when : A badge colour is wrong.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { radius, spacing } from '../../theme/spacing';
import { text } from '../../theme/typography';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: colors.successBg, fg: '#0F7A33' },
  warning: { bg: colors.warningBg, fg: '#7A5300' },
  danger: { bg: colors.dangerBg, fg: '#B31410' },
  /** Restock requested and New supplier both use the blue freed by dropping Overstock. */
  info: { bg: colors.infoBg, fg: '#0A5AB0' },
  neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
};

interface Props {
  label: string;
  tone?: Tone;
}

export function Badge({ label, tone = 'neutral' }: Props) {
  const { bg, fg } = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[text.caption, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
