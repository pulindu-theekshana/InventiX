/**
 * Add product
 * 
 * Purpose : Search the shared catalog, pick a product, set the starting quantity and the low threshold. Spec 5.2 is why this is a search first: both sides must point at the same catalog row or nothing can ever be matched. A product nobody has entered yet can be added to the catalog from here.
 * Spec    : Section 6.7
 * Look here when : Adding a product fails.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Chip } from '../../../src/components/ui/Chip';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useAsync } from '../../../src/hooks/useAsync';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { createCatalogProduct, listCategories, searchCatalog } from '../../../src/api/catalog';
import { addStockItem } from '../../../src/api/stocks';
import type { CatalogProduct } from '../../../src/types/database';

export default function AddProduct() {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<CatalogProduct | null>(null);
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('');
  const submit = useSubmit();
  const [creating, setCreating] = useState(false);
  const [packSize, setPackSize] = useState('');
  const [category, setCategory] = useState('');
  const create = useSubmit();
  const categories = useAsync(listCategories, []);
  const results = useAsync(() => searchCatalog(query), [query]);

  /**
   * Spec 6.7 — offer a default the owner can accept and move on, rather than asking for a
   * considered decision on every product. Once sales history exists the backend suggests a
   * better one from actual sales velocity.
   */
  const suggested = quantity ? Math.max(Math.round(Number(quantity) * 0.25), 1) : null;

  async function save() {
    if (!chosen) return;
    const ok = await submit.run(() =>
      addStockItem({
        catalog_product_id: chosen.id,
        quantity_on_hand: Number(quantity),
        low_threshold: Number(threshold || suggested || 0),
      }),
    );
    // Only leave the screen on success; a refusal must stay visible with the form intact.
    if (ok) router.back();
  }

  /** The new row then goes through the same quantity and threshold step as any other product. */
  async function saveNew() {
    const ok = await create.run(async () =>
      setChosen(await createCatalogProduct({ name: query.trim(), pack_size: packSize.trim(), category: category.trim() })),
    );
    if (ok) setCreating(false);
  }

  if (creating) {
    return (
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.gap}>
          <Text style={text.h2}>New product</Text>
          <Text style={[text.caption, styles.muted]}>
            Every shop and supplier shares this list, so name it the way it is printed on the pack.
          </Text>
          <Input label="Product name" value={query} onChangeText={setQuery} placeholder="Munchee Cream Crackers" icon="pricetag-outline" />
          <Input label="Pack size" value={packSize} onChangeText={setPackSize} placeholder="490 g" icon="resize-outline" />
          <Text style={[text.label, styles.muted]}>Category</Text>
          <View style={styles.chips}>
            {(categories.data ?? []).map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <ErrorBanner message={create.error} />
          <Button
            label="Continue"
            variant="accent"
            size="lg"
            loading={create.busy}
            disabled={query.trim().length < 2 || !packSize.trim() || !category}
            onPress={saveNew}
            fullWidth
          />
          <Button label="Back to search" variant="ghost" onPress={() => setCreating(false)} fullWidth />
        </Card>
      </ScrollView>
    );
  }

  if (chosen) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.gap}>
          <View style={styles.chosen}>
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
          <Input
            label="How many do you have now?"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="120"
            keyboardType="number-pad"
            icon="cube-outline"
          />
          <Input
            label="Warn me when it drops to"
            value={threshold}
            onChangeText={setThreshold}
            placeholder={suggested ? String(suggested) : '20'}
            keyboardType="number-pad"
            icon="trending-down-outline"
            hint={
              suggested
                ? 'Leave blank to use ' + suggested + ', about a quarter of what you hold.'
                : 'You can change this at any time.'
            }
          />
          <ErrorBanner message={submit.error} />
          <Button
            label="Add to my stock"
            variant="accent"
            size="lg"
            loading={submit.busy}
            disabled={!quantity}
            onPress={save}
            fullWidth
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchWrap}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search the product catalog"
          icon="search"
          autoFocus
        />
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {(results.data ?? []).map((p) => (
          <Card key={p.id} onPress={() => setChosen(p)} style={styles.result}>
            <View style={styles.resultRow}>
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
            message="Products come from a shared catalog so shops and suppliers always mean the same thing. If yours is missing, add it."
            actionLabel="Add a new product"
            onAction={() => setCreating(true)}
          />
        ) : (
          // Also offered under a partial match: searching "rice" can list rices that are not yours.
          <Button label="Can't find it? Add a new product" variant="ghost" onPress={() => setCreating(true)} fullWidth />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  searchWrap: { padding: spacing.lg, paddingBottom: spacing.sm },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  muted: { color: colors.textMuted },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  result: { marginBottom: spacing.sm, borderRadius: radius.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
