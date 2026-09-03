/**
 * Error banner
 * 
 * Purpose : Shows a backend error message in a consistent place. Never show a disabled button with no explanation.
 * Spec    : Section 6.5
 * Look here when : An error happens silently.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';

interface Props {
  /** One message, or the list of failing lines from the restock popup. */
  message?: string | null;
  messages?: string[];
  tone?: 'danger' | 'warning' | 'info';
}

const TONE = {
  danger: { bg: colors.dangerBg, fg: '#B31410', icon: 'alert-circle' as const },
  warning: { bg: colors.warningBg, fg: '#7A5300', icon: 'warning' as const },
  info: { bg: colors.infoBg, fg: '#0A5AB0', icon: 'information-circle' as const },
};

export function ErrorBanner({ message, messages, tone = 'danger' }: Props) {
  const list = messages ?? (message ? [message] : []);
  if (list.length === 0) return null;
  const { bg, fg, icon } = TONE[tone];

  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={18} color={fg} style={styles.icon} />
      <View style={styles.messages}>
        {list.map((m) => (
          <Text key={m} style={[text.label, { color: fg }]}>
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  icon: { marginTop: 1 },
  messages: { flex: 1, gap: spacing.xs },
});
