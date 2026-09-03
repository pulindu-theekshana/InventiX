/**
 * Report detail
 * 
 * Purpose : One report section. Empty until sales history exists, so it explains what will appear here and what has to happen first rather than showing a chart of nothing.
 * Spec    : Section 7.1
 * Look here when : A report chart is wrong.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { REPORT_SECTIONS } from '../../../src/api/reports';

/** What each report needs before it can say anything. */
const NEEDS: Record<string, string> = {
  'stock-movement': 'At least one applied sales report, so there is movement to plot.',
  'best-worst': 'A few weeks of sales records, so fast and slow are meaningful.',
  'spend-by-supplier': 'At least one completed order.',
  'delivery-times': 'At least one order that reached Completed, which is what times a delivery.',
  'stock-outs': 'Sales history, so we can see when a product reached zero.',
};

export default function ReportDetail() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const section = REPORT_SECTIONS.find((s) => s.key === type);

  if (!section) {
    return (
      <View style={styles.root}>
        <Text style={[text.body, styles.muted]}>That report does not exist.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.head}>
        <View style={styles.iconRing}>
          <Ionicons name={section.icon as never} size={24} color={colors.accent} />
        </View>
        <Text style={text.h2}>{section.title}</Text>
        <Text style={[text.body, styles.muted]}>{section.description}</Text>
      </Card>

      <Card style={styles.gap}>
        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={[text.bodyStrong, styles.flex]}>Nothing to show yet</Text>
        </View>
        <Text style={[text.label, styles.muted]}>{NEEDS[section.key]}</Text>
      </Card>

      <Button
        label="Upload a sales report"
        variant="accent"
        icon="cloud-upload-outline"
        onPress={() => router.push('/(customer)/stocks/upload')}
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  head: { gap: spacing.sm },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
});
