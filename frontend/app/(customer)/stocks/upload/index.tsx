/**
 * Upload sales report
 * 
 * Purpose : Step one of three. Pick a CSV or Excel export from the shop POS. Without this stock never decreases, nothing ever becomes low, and the whole application never triggers.
 * Spec    : Section 6.6
 * Look here when : Choosing a file fails.
 */

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { ErrorBanner } from '../../../../src/components/ErrorBanner';
import { colors } from '../../../../src/theme/colors';
import { radius, spacing } from '../../../../src/theme/spacing';
import { text } from '../../../../src/theme/typography';
import { toMessage } from '../../../../src/lib/errors';
import { startUpload } from '../../../../src/api/uploads';

const STEPS = [
  'Choose your sales report file',
  'Tell us which columns hold what',
  'Match any product names we do not recognise',
];

export default function UploadStart() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setBusy(true);
      const session = await startUpload(result.assets[0]);
      router.push(`/(customer)/stocks/upload/mapping?upload=${session.id}`);
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ErrorBanner message={error} />

      <Card style={styles.hero}>
        <View style={styles.iconRing}>
          <Ionicons name="cloud-upload-outline" size={30} color={colors.accent} />
        </View>
        <Text style={[text.h2, styles.centre]}>Upload a sales report</Text>
        <Text style={[text.body, styles.lead]}>
          Export a sales report from your POS as CSV or Excel. We reduce your stock by what you
          sold, so low stock warnings stay accurate.
        </Text>
        <Button
          label="Choose a file"
          variant="accent"
          size="lg"
          icon="document-attach-outline"
          loading={busy}
          onPress={pickFile}
          fullWidth
        />
      </Card>

      <Card style={styles.steps}>
        <Text style={text.title}>How it works</Text>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={[text.caption, { color: colors.onAccent }]}>{i + 1}</Text>
            </View>
            <Text style={[text.label, styles.muted]}>{s}</Text>
          </View>
        ))}
        <Text style={[text.caption, styles.note]}>
          The column choices and product matches are remembered, so the next upload is one tap.
          Uploading the same file twice is rejected, so stock is never reduced twice.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  hero: { gap: spacing.md, alignItems: 'center' },
  iconRing: {
    width: 66,
    height: 66,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { textAlign: 'center' },
  lead: { color: colors.textMuted, textAlign: 'center' },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: colors.textMuted, flex: 1 },
  note: { color: colors.textSubtle, marginTop: spacing.sm },
});
