/**
 * Column mapping
 * 
 * Purpose : Step two of three. Tell the app which column holds the product name, the quantity sold and the date. Saved and pre-filled next time, so this is a one-time cost.
 * Spec    : Section 6.6
 * Look here when : Columns map to the wrong fields.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { colors } from '../../../../src/theme/colors';
import { radius, spacing } from '../../../../src/theme/spacing';
import { text } from '../../../../src/theme/typography';
import { useSubmit } from '../../../../src/hooks/useSubmit';
import { ErrorBanner } from '../../../../src/components/ErrorBanner';
import { currentUpload, saveMapping } from '../../../../src/api/uploads';

type Field = 'product' | 'quantity' | 'date';

const FIELDS: { key: Field; label: string; help: string }[] = [
  { key: 'product', label: 'Product name', help: 'The column with the product as your POS writes it.' },
  { key: 'quantity', label: 'Quantity sold', help: 'How many units left the shop.' },
  { key: 'date', label: 'Sale date', help: 'When the sale happened.' },
];

export default function Mapping() {
  const { upload } = useLocalSearchParams<{ upload: string }>();
  const session = currentUpload();
  const [mapping, setMapping] = useState<Record<Field, string | null>>({
    product: null,
    quantity: null,
    date: null,
  });
  const [active, setActive] = useState<Field>('product');
  const submit = useSubmit();

  /** Pre-fill from the shop's last upload, which is the whole point of storing the mapping. */
  useEffect(() => {
    if (session) setMapping(session.suggested_mapping);
  }, [session]);

  const columns = session?.columns ?? [];
  const complete = mapping.product && mapping.quantity && mapping.date;

  async function next() {
    const ok = await submit.run(() =>
      saveMapping(upload ?? 'u-new', mapping as Record<Field, string>),
    );
    if (!ok) return;
    router.push(`/(customer)/stocks/upload/unmatched?upload=${upload ?? 'u-new'}`);
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ErrorBanner message={submit.error} />
        {!session ? (
          <ErrorBanner message="That upload has expired. Please choose the file again." />
        ) : null}
        <Card style={styles.gap}>
          <Text style={text.title}>{session?.file_name ?? 'Your file'}</Text>
          <Text style={[text.caption, styles.muted]}>
            {session?.row_count ?? 0} rows found. Tap a field, then tap the column it
            matches.
          </Text>
        </Card>

        <View style={styles.fields}>
          {FIELDS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setActive(f.key)}
              style={[styles.field, active === f.key && styles.fieldActive]}
            >
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{f.label}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {mapping[f.key] ?? f.help}
                </Text>
              </View>
              {mapping[f.key] ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              ) : (
                <Ionicons name="ellipse-outline" size={20} color={colors.border} />
              )}
            </Pressable>
          ))}
        </View>

        <Text style={[text.label, styles.sectionLabel]}>Columns in your file</Text>
        <View style={styles.columns}>
          {columns.map((c) => {
            const usedBy = (Object.keys(mapping) as Field[]).find((k) => mapping[k] === c);
            return (
              <Pressable
                key={c}
                onPress={() => setMapping((m) => ({ ...m, [active]: c }))}
                style={[styles.column, usedBy && styles.columnUsed]}
              >
                <Text style={[text.label, usedBy ? { color: colors.accent } : null]}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Continue"
          variant="accent"
          size="lg"
          disabled={!complete}
          loading={submit.busy}
          onPress={next}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.xs },
  muted: { color: colors.textMuted },
  fields: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: spacing.md,
  },
  fieldActive: { borderColor: colors.accent },
  flex: { flex: 1 },
  sectionLabel: { color: colors.textMuted },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  column: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  columnUsed: { borderColor: colors.accent, backgroundColor: colors.primaryTint },
  footer: { padding: spacing.lg, backgroundColor: colors.surface },
});
