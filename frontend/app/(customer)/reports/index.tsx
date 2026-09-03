/**
 * Reports feed
 * 
 * Purpose : The five reports spec 7.1 defines, as sections. No figures and no charts yet: spec 7 builds this feed last because a report needs sales history to report on, and none exists until the other feeds have been in use.
 * Spec    : Section 7
 * Look here when : The reports feed renders wrongly.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { REPORT_SECTIONS } from '../../../src/api/reports';

export default function ReportsHome() {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.intro}>
        <View style={styles.introRow}>
          <Ionicons name="time-outline" size={20} color={colors.info} />
          <Text style={[text.bodyStrong, styles.flex]}>Waiting on sales history</Text>
        </View>
        <Text style={[text.label, styles.muted]}>
          These reports read your sales and order history. Upload a sales report and place a few
          orders, and they will start filling in.
        </Text>
      </Card>

      {REPORT_SECTIONS.map((s) => (
        <Card
          key={s.key}
          onPress={() => router.push(`/(customer)/reports/${s.key}`)}
          style={styles.card}
        >
          <View style={styles.iconRing}>
            <Ionicons name={s.icon as never} size={20} color={colors.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={text.bodyStrong}>{s.title}</Text>
            <Text style={[text.caption, styles.muted]}>{s.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </Card>
      ))}

      <Text style={[text.caption, styles.footNote]}>
        Forecasting, seasonal uplift, threshold suggestions and supplier recommendations are a
        later phase. They train on the history these reports are built from.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  intro: { gap: spacing.sm, backgroundColor: colors.infoBg, marginBottom: spacing.sm },
  introRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md },
  iconRing: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  footNote: { color: colors.textSubtle, marginTop: spacing.md },
});
