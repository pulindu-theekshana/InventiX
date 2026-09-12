/**
 * Edit listing
 * 
 * Purpose : Change quantity, price, minimum order and lead time, or stop selling. Spec 10.1 deactivates rather than deletes, so the order history that references this listing keeps working.
 * Spec    : Section 10.1
 * Look here when : Editing a listing fails.
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Card } from '../../../src/components/ui/Card';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { Badge } from '../../../src/components/ui/Badge';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { useAsync } from '../../../src/hooks/useAsync';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { getListing, setActive, updateListing } from '../../../src/api/listings';

export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useAsync(() => getListing(id), [id]);
  const [form, setForm] = useState({ quantity: '', price: '', min: '', lead: '' });
  const { busy, error, run } = useSubmit();

  useEffect(() => {
    const l = listing.data;
    if (l) {
      setForm({
        quantity: String(l.quantity_available),
        price: String(l.unit_price),
        min: String(l.min_order_quantity),
        lead: String(l.lead_time_days),
      });
    }
  }, [listing.data]);

  const l = listing.data;
  if (listing.loading) return <View style={styles.root} />;
  if (!l) return <ErrorBanner message="That listing could not be found." />;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** Stay on the form when the save is refused, so the reason is still on screen. */
  async function save() {
    const ok = await run(() =>
      updateListing(id, {
        quantity_available: Number(form.quantity),
        unit_price: Number(form.price),
        min_order_quantity: Number(form.min),
        lead_time_days: Number(form.lead),
      }),
    );
    if (!ok) return;
    router.back();
  }

  async function toggle() {
    if (!(await run(() => setActive(id, !l!.is_active)))) return;
    listing.refresh();
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.gap}>
        <Text style={text.h2}>{l.product.name}</Text>
        <Text style={[text.label, styles.muted]}>
          {l.product.pack_size} · {l.product.category}
        </Text>
        <View style={styles.badges}>
          <Badge label={l.is_active ? 'Selling' : 'Not selling'} tone={l.is_active ? 'success' : 'neutral'} />
          {l.is_low && l.is_active ? <Badge label="Running low" tone="warning" /> : null}
        </View>
      </Card>

      <Card style={styles.gap}>
        <Input label="Quantity available" value={form.quantity} onChangeText={set('quantity')} keyboardType="number-pad" icon="cube-outline" />
        <Input label="Price per unit (LKR)" value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" icon="pricetag-outline" />
        <Input label="Smallest order you accept" value={form.min} onChangeText={set('min')} keyboardType="number-pad" icon="funnel-outline" />
        <Input label="Typical delivery time (days)" value={form.lead} onChangeText={set('lead')} keyboardType="number-pad" icon="time-outline" />
        <ErrorBanner message={error} />
        <Button label="Save changes" variant="accent" size="lg" loading={busy} onPress={save} fullWidth />
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>{l.is_active ? 'Stop selling this' : 'Start selling this again'}</Text>
        <Text style={[text.caption, styles.muted]}>
          {l.is_active
            ? 'Customers stop seeing it in search. Your past orders keep working, which is why this is not a delete.'
            : 'It returns to customer search results at the price above.'}
        </Text>
        <Button
          label={l.is_active ? 'Stop selling' : 'Start selling'}
          variant={l.is_active ? 'outline' : 'accent'}
          loading={busy}
          onPress={toggle}
          fullWidth
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  gap: { gap: spacing.md },
  muted: { color: colors.textMuted },
  badges: { flexDirection: 'row', gap: spacing.sm },
});
