/**
 * Unmatched products
 * 
 * Purpose : Step three of three. The POS names we could not resolve to a catalog product. Each choice is saved as an alias and reused forever after, so this list shrinks to nothing over time.
 * Spec    : Section 6.6
 * Look here when : A previously mapped product is asked about again.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../src/components/ui/Card';
import { Button } from '../../../../src/components/ui/Button';
import { Input } from '../../../../src/components/ui/Input';
import { Modal } from '../../../../src/components/ui/Modal';
import { EmptyState } from '../../../../src/components/EmptyState';
import { ErrorBanner } from '../../../../src/components/ErrorBanner';
import { colors } from '../../../../src/theme/colors';
import { radius, spacing } from '../../../../src/theme/spacing';
import { text } from '../../../../src/theme/typography';
import { useAsync } from '../../../../src/hooks/useAsync';
import { useSubmit } from '../../../../src/hooks/useSubmit';
import { applyUpload, getUnmatched, resolveUnmatched } from '../../../../src/api/uploads';
import { searchCatalog } from '../../../../src/api/catalog';

export default function Unmatched() {
  const { upload } = useLocalSearchParams<{ upload: string }>();
  const rows = useAsync(() => getUnmatched(upload ?? 'u-new'), [upload]);
  const [picking, setPicking] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const submit = useSubmit();
  const catalog = useAsync(() => searchCatalog(query), [query]);

  const list = rows.data ?? [];
  const outstanding = list.filter((r) => !resolved[r.pos_product_name]).length;

  async function choose(posName: string, productId: string, productName: string) {
    const ok = await submit.run(() => resolveUnmatched(upload ?? 'u-new', posName, productId));
    if (!ok) return;
    setResolved((r) => ({ ...r, [posName]: productName }));
    setPicking(null);
    setQuery('');
  }

  async function finish() {
    // Applying can be refused -- an expired upload, or one already applied. Say so
    // rather than leaving the button spinning.
    const ok = await submit.run(() => applyUpload(upload ?? 'u-new'));
    if (!ok) return;
    // replace, not dismissAll: these steps are tab screens, not a modal stack, so there is
    // nothing to pop and expo-router warns about the unhandled action.
    router.replace('/(customer)/stocks');
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ErrorBanner message={submit.error} />
        {list.length === 0 ? (
          <EmptyState
            icon="checkmark-done-outline"
            title="Everything matched"
            message="Every product in your file resolved to a catalog product. Nothing to do here."
          />
        ) : (
          <>
            <Card style={styles.gap}>
              <Text style={text.title}>{outstanding} to match</Text>
              <Text style={[text.caption, styles.muted]}>
                These names appear in your POS export but we do not know what they are. Match
                each one once and we will remember it for every future upload.
              </Text>
            </Card>

            {list.map((r) => {
              const done = resolved[r.pos_product_name];
              return (
                <Card
                  key={r.pos_product_name}
                  onPress={() => setPicking(r.pos_product_name)}
                  style={styles.row}
                >
                  <View style={styles.flex}>
                    <Text style={text.bodyStrong}>{r.pos_product_name}</Text>
                    <Text style={[text.caption, styles.muted]}>
                      {r.occurrences} rows in this file
                    </Text>
                    {done ? (
                      <Text style={[text.caption, { color: colors.success }]}>
                        Matched to {done}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'help-circle-outline'}
                    size={22}
                    color={done ? colors.success : colors.warning}
                  />
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={outstanding > 0 ? 'Skip the rest and apply' : 'Apply to my stock'}
          variant={outstanding > 0 ? 'outline' : 'accent'}
          size="lg"
          loading={submit.busy}
          onPress={finish}
          fullWidth
        />
        <Text style={[text.caption, styles.footNote]}>
          Applying reduces your stock and records an audit row for every change.
        </Text>
      </View>

      <Modal
        visible={picking !== null}
        onClose={() => setPicking(null)}
        title={'What is ' + (picking ?? '') + '?'}
      >
        <Input value={query} onChangeText={setQuery} placeholder="Search the catalog" icon="search" />
        {(catalog.data ?? []).map((p) => (
          <Pressable
            key={p.id}
            style={styles.option}
            onPress={() => picking && choose(picking, p.id, p.name)}
          >
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>{p.name}</Text>
              <Text style={[text.caption, styles.muted]}>
                {p.pack_size} · {p.category}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.md },
  gap: { gap: spacing.xs },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md },
  flex: { flex: 1, gap: 2 },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, gap: spacing.sm },
  footNote: { color: colors.textSubtle, textAlign: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
});
