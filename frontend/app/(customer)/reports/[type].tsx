/**
 * Generated report
 *
 * Purpose : Renders a report the backend generated. `inventory` is real today; `sales` explains what has to happen first, because sales history does not exist until an uploaded sales report has been applied.
 * Spec    : Section 7.1
 * Look here when : A report figure looks wrong, or the trend line disagrees with the totals.
 */

import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Badge, type Tone } from '../../../src/components/ui/Badge';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { TrendChart } from '../../../src/components/TrendChart';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currencyShort, quantity } from '../../../src/lib/format';
import { useAsync } from '../../../src/hooks/useAsync';
import { useSubmit } from '../../../src/hooks/useSubmit';
import { useAuth } from '../../../src/hooks/useAuth';
import { generateInventoryReport } from '../../../src/api/reports';
import { inventoryCsv, shareCsv } from '../../../src/lib/exportReport';
import { reportName } from '../../../src/lib/reportHistory';
import type { StockStatus } from '../../../src/types/api';

/** The same three labels StockRow shows, so a report reads like the screen it came from. */
const LABEL: Record<StockStatus, { label: string; tone: Tone }> = {
  in_stock: { label: 'In stock', tone: 'success' },
  low_stock: { label: 'Low stock', tone: 'warning' },
  restock_requested: { label: 'Requested', tone: 'info' },
};

export default function GeneratedReport() {
  const { type, days } = useLocalSearchParams<{ type: string; days?: string }>();
  /** Falls back to 30 when opened without a period, which the backend also defaults to. */
  const window = Number(days) >= 7 && Number(days) <= 90 ? Number(days) : 30;

  if (type === 'sales') return <SalesReport />;
  if (type === 'inventory') return <InventoryReport days={window} />;

  return (
    <View style={styles.message}>
      <ErrorBanner message="That report does not exist." />
    </View>
  );
}

function InventoryReport({ days }: { days: number }) {
  const report = useAsync(() => generateInventoryReport(days), [days]);
  const { profile } = useAuth();
  const exporting = useSubmit();
  const r = report.data;

  /** Written to the cache and handed to the share sheet, so it can be saved or emailed. */
  async function download() {
    if (!r) return;
    await exporting.run(async () => {
      const shared = await shareCsv(
        reportName('inventory'),
        inventoryCsv(r, profile?.business_name ?? 'Your shop'),
      );
      if (!shared) throw new Error('This device has no way to share a file.');
    });
  }

  if (report.loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[text.label, styles.muted]}>Generating your report…</Text>
      </View>
    );
  }

  if (report.error) {
    return (
      <View style={styles.message}>
        <ErrorBanner message={report.error} />
        <Button label="Try again" variant="outline" onPress={report.refresh} fullWidth />
      </View>
    );
  }

  if (!r) {
    return (
      <View style={styles.message}>
        <ErrorBanner message="The report came back empty." />
      </View>
    );
  }

  const needsAttention = r.low_stock + r.restock_requested;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <Text style={text.h2}>Stock on hand</Text>
          <Text style={[text.caption, styles.muted]}>Generated {generatedAt(r.generated_at)}</Text>
        </View>
        <Button label="Refresh" variant="ghost" size="sm" icon="refresh" onPress={report.refresh} />
      </View>

      <View style={styles.tiles}>
        <Tile label="Products" value={String(r.total_products)} />
        <Tile label="Units on hand" value={quantity(r.total_units)} />
        <Tile
          label="Stock value"
          value={r.total_value === null ? '—' : currencyShort(r.total_value)}
          note={
            r.total_value === null
              ? 'no product has a price'
              : r.priced_products < r.total_products
                ? `${r.priced_products} of ${r.total_products} priced`
                : undefined
          }
        />
        <Tile
          label="Need attention"
          value={String(needsAttention)}
          tone={needsAttention > 0 ? colors.warning : undefined}
          note={r.at_zero > 0 ? `${r.at_zero} at zero` : undefined}
        />
      </View>

      <Card style={styles.gap}>
        <Text style={text.title}>Total units, last {r.days} days</Text>
        <TrendChart points={r.trend} />
        <Text style={[text.caption, styles.subtle]}>
          Rebuilt from the adjustment trail, so it ends on exactly the total above.
        </Text>
      </Card>

      <Card style={styles.gap}>
        <View style={styles.rowBetween}>
          <Text style={text.title}>Every product</Text>
          <Text style={[text.caption, styles.muted]}>Worst first</Text>
        </View>
        {r.items.map((item) => (
          <View key={item.stock_item_id} style={styles.item}>
            <View style={styles.flex}>
              <Text style={text.bodyStrong}>{item.name}</Text>
              <Text style={[text.caption, styles.muted]}>
                {item.pack_size} · low at {item.low_threshold}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={text.bodyStrong}>{quantity(item.quantity_on_hand)}</Text>
              <Text style={[text.caption, styles.muted]}>
                {item.value === null ? 'no price' : currencyShort(item.value)}
              </Text>
            </View>
            <Badge label={LABEL[item.status].label} tone={LABEL[item.status].tone} />
          </View>
        ))}
      </Card>

      <ErrorBanner message={exporting.error} />
      <Button
        label="Download as CSV"
        variant="accent"
        icon="download-outline"
        loading={exporting.busy}
        onPress={download}
        fullWidth
      />
      <Text style={[text.caption, styles.subtle]}>
        Opens in Excel or Google Sheets. Includes every product and the daily totals behind the
        chart.
      </Text>
    </ScrollView>
  );
}

/**
 * Deliberately not a chart of nothing. Sales reports read sales_records, which stays empty
 * until an uploaded sales report has been applied, so this says what to do instead.
 */
function SalesReport() {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.gap}>
        <View style={styles.ring}>
          <Ionicons name="cart-outline" size={24} color={colors.textMuted} />
        </View>
        <Text style={text.h2}>No sales history yet</Text>
        <Text style={[text.body, styles.muted]}>
          Sales reports are built from what you have actually sold, and that comes from your POS.
          Export a sales report from it, upload the file, and these start filling in.
        </Text>
      </Card>

      <Card style={styles.gap}>
        <Text style={text.title}>What appears once there is data</Text>
        <Line icon="podium-outline" value="Best and worst sellers over a period you choose" />
        <Line icon="swap-vertical-outline" value="How one product rose and fell" />
        <Line icon="alert-circle-outline" value="How often a product reached zero" />
        <Line icon="wallet-outline" value="What you spent with each supplier" />
      </Card>

      <Button
        label="Upload a sales report"
        variant="accent"
        icon="cloud-upload-outline"
        onPress={() => router.push('/(customer)/stocks/upload')}
        fullWidth
      />
      <Text style={[text.caption, styles.subtle]}>
        Your inventory report works today — it reads stock levels rather than sales.
      </Text>
    </ScrollView>
  );
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={[text.caption, styles.muted]}>{label}</Text>
      <Text style={[text.h2, tone ? { color: tone } : null]}>{value}</Text>
      {note ? <Text style={[text.caption, styles.subtle]}>{note}</Text> : null}
    </View>
  );
}

function Line({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textSubtle} />
      <Text style={[text.label, styles.flex]}>{value}</Text>
    </View>
  );
}

/** "today at 14:32" reads better on a report than a full timestamp. */
function generatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString()
    ? `today at ${time}`
    : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} at ${time}`;
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  message: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  gap: { gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemRight: { alignItems: 'flex-end' },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ring: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  subtle: { color: colors.textSubtle },
});
