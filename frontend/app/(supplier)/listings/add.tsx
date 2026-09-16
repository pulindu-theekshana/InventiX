/**
 * Add product
 *
 * Purpose : One screen to put a product up for sale — pick it from the catalog, then set price, quantity and delivery time. Spec 4.1 sends a new supplier straight here, because they cannot sell anything until one exists.
 * Spec    : Section 10.1
 * Look here when : Adding a listing fails, or a product cannot be found to add.
 */

import { useMemo, useState } from 'react';
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
import { Chip } from '../../../src/components/ui/Chip';
import type { CatalogProduct } from '../../../src/types/database';

/** Stands for every category at once, and is never a real one. */
const ALL = 'All';

export default function AddProduct() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [chosen, setChosen] = useState<CatalogProduct | null>(null);
  const [form, setForm] = useState({ price: '', quantity: '', lead: '' });
  const { busy, error, run } = useSubmit();

  const results = useAsync(() => searchCatalog(query), [query]);
  /**
   * The chips come from the whole catalog, not from `results`. Deriving them from the
   * search would make categories appear and vanish as the supplier types, and the chip
   * they were filtering by could remove itself.
   */
  const catalog = useAsync(() => searchCatalog(''), []);

  const categories = useMemo(
    () => [ALL, ...Array.from(new Set((catalog.data ?? []).map((p) => p.category))).sort()],
    [catalog.data],
  );

  const visible = (results.data ?? []).filter(
    (p) => category === ALL || p.category === category,
  );

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = Boolean(chosen && form.price && form.quantity && form.lead);

  /** Only leave for the list once the listing actually exists — a refusal belongs on this form. */
  async function save() {
    if (!chosen) return;
    const ok = await run(() =>
      createListing({
        catalog_product_id: chosen.id,
        unit_price: Number(form.price),
        quantity_available: Number(form.quantity),
        lead_time_days: Number(form.lead),
      }),
    );
    if (!ok) return;
    router.replace('/(supplier)/listings');
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card style={styles.gap}>
        <Text style={[text.caption, styles.section]}>PRODUCT</Text>

        {chosen ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={text.h2}>{chosen.name}</Text>
              <View style={styles.chosenMeta}>
                <Tag label={chosen.category} />
                <Text style={[text.caption, styles.muted]}>
                  {chosen.pack_size} · {chosen.unit}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setChosen(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Choose a different product"
            >
              <Ionicons name="close-circle" size={26} color={colors.textSubtle} />
            </Pressable>
          </View>
        ) : (
          <>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search the catalog"
              icon="search"
              autoFocus
            />
            <View style={styles.chips}>
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={c === category}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
            <Text style={[text.caption, styles.hint]}>
              Category belongs to the product, so you pick rather than type. That is what lets a
              customer searching for rice find yours.
            </Text>
          </>
        )}
      </Card>

      {/* The catalog list only exists until a product is chosen; after that the form replaces it. */}
      {!chosen ? (
        <View style={styles.results}>
          {visible.map((p) => (
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
          {!results.loading && visible.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Nothing matches that"
              message="If the product you sell is missing from the catalog, request it and it will be reviewed."
            />
          ) : null}
        </View>
      ) : (
        <>
          <Card style={styles.gap}>
            <Input
              label="Price per unit (LKR)"
              value={form.price}
              onChangeText={set('price')}
              placeholder="1250"
              keyboardType="decimal-pad"
              icon="pricetag-outline"
            />
            <Input
              label="Quantity available"
              value={form.quantity}
              onChangeText={set('quantity')}
              placeholder="240"
              keyboardType="number-pad"
              icon="cube-outline"
            />
            <Input
              label="Delivery time (days)"
              value={form.lead}
              onChangeText={set('lead')}
              placeholder="2"
              keyboardType="number-pad"
              icon="time-outline"
              hint="Your own estimate. Customers are ranked on your measured time, not this."
            />
          </Card>

          <ErrorBanner message={error} />
          <Button
            label="Add product"
            variant="accent"
            size="lg"
            loading={busy}
            disabled={!canSave}
            onPress={save}
            fullWidth
          />
          <Text style={[text.caption, styles.hint]}>
            The smallest order you accept starts at 1. Change it on the listing afterwards.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

/** The chosen product's category. Read only, because the catalog owns it. */
function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={[text.caption, { color: colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  section: { color: colors.textSubtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  muted: { color: colors.textMuted },
  hint: { color: colors.textSubtle },
  chosenMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.primaryTint,
    paddingVertical: 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  results: { gap: spacing.sm },
  result: { borderRadius: radius.md },
});
