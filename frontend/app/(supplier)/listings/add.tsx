/**
 * Add listing
 * 
 * Purpose : Pick a catalog product and set quantity, price, minimum order and lead time. Spec 4.1 sends a new supplier straight here, because they cannot sell anything until one exists.
 * Spec    : Section 10.1
 * Look here when : Adding a listing fails.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useAsync } from '../../../src/hooks/useAsync';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { searchCatalog } from '../../../src/api/catalog';
import { createListing } from '../../../src/api/listings';
import type { CatalogProduct } from '../../../src/types/database';

export default function AddListing() {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<CatalogProduct | null>(null);
  const [form, setForm] = useState({ quantity: '', price: '', min: '', lead: '' });
  const { busy, error, run } = useSubmit();
  const results = useAsync(() => searchCatalog(query), [query]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = chosen && form.quantity && form.price && form.min && form.lead;

  /** Only leave for the list once the listing actually exists — a refusal belongs on this form. */
  async function save() {
    if (!chosen) return;
    const ok = await run(() =>
      createListing({
        catalog_product_id: chosen.id,
        quantity_available: Number(form.quantity),
        unit_price: Number(form.price),
        min_order_quantity: Number(form.min),
        lead_time_days: Number(form.lead),
      }),
    );
    if (!ok) return;
    router.replace('/(supplier)/listings');
  }

  if (!chosen) {
    return (
      <View style={styles.root}>
        <View style={styles.searchWrap}>
          <Input value={query} onChangeText={setQuery} placeholder="Search the product catalog" icon="search" autoFocus />
          <Text style={[text.caption, styles.hint]}>
            Products come from a shared catalog, so a customer searching for rice finds your
            rice. That is why you pick rather than type.
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {(results.data ?? []).map((p) => (
            <Card key={p.id} onPress={() => setChosen(p)} style={styles.result}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={text.bodyStrong}>{p.name}</Text>
                  <Text style={[text.caption, styles.muted]}>
                    {p.pack_size} · {p.category}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </View>
            </Card>
          ))}
          {!results.loading && (results.data ?? []).length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Nothing matches that"
              message="If the product you sell is missing from the catalog, request it and it will be reviewed."
              actionLabel="Request this product"
              onAction={() => {}}
            />
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.gap}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={text.h2}>{chosen.name}</Text>
            <Text style={[text.label, styles.muted]}>
              {chosen.pack_size} · {chosen.category}
            </Text>
          </View>
          <Pressable onPress={() => setChosen(null)} hitSlop={8} accessibilityLabel="Choose another">
            <Ionicons name="close-circle" size={24} color={colors.textSubtle} />
          </Pressable>
        </View>
      </Card>

      <Card style={styles.gap}>
        <Input label="How many do you have?" value={form.quantity} onChangeText={set('quantity')} placeholder="240" keyboardType="number-pad" icon="cube-outline" />
        <Input label="Price per unit (LKR)" value={form.price} onChangeText={set('price')} placeholder="1250" keyboardType="decimal-pad" icon="pricetag-outline" />
        <Input label="Smallest order you accept" value={form.min} onChangeText={set('min')} placeholder="10" keyboardType="number-pad" icon="funnel-outline" />
        <Input
          label="Typical delivery time (days)"
          value={form.lead}
          onChangeText={set('lead')}
          placeholder="2"
          keyboardType="number-pad"
          icon="time-outline"
          hint="Your own estimate. Customers are ranked on your measured time, not this."
        />
        <ErrorBanner message={error} />
        <Button label="Add listing" variant="accent" size="lg" loading={busy} disabled={!canSave} onPress={save} fullWidth />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  hint: { color: colors.textSubtle },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  result: { marginBottom: spacing.sm, borderRadius: radius.md },
});
