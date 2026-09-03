/**
 * Empty state
 * 
 * Purpose : What a new user sees before they have any data. A shop with no stock items is the normal first experience.
 * Spec    : Section 6.7
 * Look here when : A new user sees a blank screen with no guidance.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui/Button';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  icon = 'cube-outline',
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={34} color={colors.accent} />
      </View>
      <Text style={[text.h2, styles.title]}>{title}</Text>
      <Text style={[text.body, styles.message]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="accent" style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" size="sm" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.md },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { color: colors.text, textAlign: 'center' },
  message: { color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing.sm },
});
