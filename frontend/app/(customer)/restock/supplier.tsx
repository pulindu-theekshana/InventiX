/**
 * Choose a supplier
 *
 * Purpose : Selection mode for a restock request: the suppliers who stock the product, best ranked first, with anyone short of the quantity marked rather than hidden. Picking one regenerates the message.
 * Spec    : Section 9.3
 * Look here when : The wrong suppliers are offered for a restock, or picking one does not change the message.
 *
 * NOTE: this was the Suppliers tab with a `select=1` parameter. A tab keeps its last
 * parameters, so browsing the feed afterwards silently stayed in selection mode and showed
 * only the suppliers for whatever was last ordered.
 */

import { useSyncExternalStore } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SupplierRow } from '../../../src/components/SupplierRow';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { Card } from '../../../src/components/ui/Card';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useSuppliers, useSuppliersForOrder } from '../../../src/hooks/useSuppliers';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { generateMessage } from '../../../src/api/ordering';
import * as draftStore from '../../../src/stores/restockDraftStore';
import type { SupplierView } from '../../../src/types/api';

export default function ChooseSupplier() {
  const draft = useSyncExternalStore(draftStore.subscribe, draftStore.getDraft, draftStore.getDraft);
  const submit = useSubmit();

  /**
   * Spec 9.3. One product decides the list; a multi-product request cannot be narrowed that
   * way, so it falls back to every supplier and lets the owner judge.
   */
  const line = draft?.lines.length === 1 ? draft.lines[0] : null;
  const forOrder = useSuppliersForOrder(
    line?.catalog_product_id ?? null,
    line?.quantity_requested ?? 0,
  );
  const all = useSuppliers('');
  const suppliers = line ? forOrder : all;
  const list = suppliers.data ?? [];

  async function choose(supplier: SupplierView) {
    if (!draft) {
      router.replace('/(customer)/stocks');
      return;
    }
    const ok = await submit.run(async () => {
      // Regenerated in full by the backend: a different supplier has different prices,
      // availability and minimums, so patching the old text would be wrong. Spec 6.5.
      const { message_body } = await generateMessage(draft.lines, supplier);
      draftStore.changeSupplier(supplier, message_body);
    });
    if (ok) router.replace('/(customer)/restock' as never);
  }

  if (!draft) {
    return (
      <View style={styles.root}>
        <EmptyState
          icon="people-outline"
          title="No request open"
          message="Start a restock request first, then choose who to send it to."
          actionLabel="Back to Stocks"
          onAction={() => router.replace('/(customer)/stocks')}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Card style={styles.banner}>
        <Ionicons name="information-circle" size={18} color={colors.info} />
        <Text style={[text.label, styles.flex]}>
          {line
            ? `Suppliers who stock ${line.name}, best ranked first. The message is rewritten for whoever you pick.`
            : 'Choose a supplier for this order. The message is rewritten for whoever you pick.'}
        </Text>
      </Card>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={suppliers.refreshing} onRefresh={suppliers.refresh} />
        }
      >
        <ErrorBanner message={suppliers.error} />
        <ErrorBanner message={submit.error} />

        {list.length === 0 && !suppliers.loading ? (
          <EmptyState
            icon="people-outline"
            title="Nobody stocks this yet"
            message="No supplier on InventiX lists this product. Try another product, or ask your supplier to add it."
          />
        ) : (
          list.map((s, i) => (
            <SupplierRow key={s.id} supplier={s} rank={i + 1} selectionMode onPress={() => choose(s)} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: 0,
  },
  scroll: { padding: spacing.lg, gap: spacing.md },
});
