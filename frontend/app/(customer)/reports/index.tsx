/**
 * Reports feed
 *
 * Purpose : Two tabs over one period. Inventory reads stock levels and works from the first product added; Sales reads sales history, which exists only once an uploaded sales report has been applied.
 * Spec    : Section 7
 * Look here when : A Generate report button does nothing, or the overview chart disagrees with the report it opens.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { ErrorBanner } from '../../../src/components/ErrorBanner';
import { TrendChart } from '../../../src/components/TrendChart';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/spacing';
import { text } from '../../../src/theme/typography';
import { currencyShort, quantity } from '../../../src/lib/format';
import { useAsync } from '../../../src/hooks/useAsync';
import { generateInventoryReport } from '../../../src/api/reports';
import {
  listReports,
  recordReport,
  reportName,
  type GeneratedReport,
} from '../../../src/lib/reportHistory';

type Tab = 'inventory' | 'sales';

/**
 * A real calendar picker needs a date-picker dependency this project does not carry, and the
 * backend takes a window in days. These are the three windows worth looking at.
 */
const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

export default function ReportsHome() {
  /** Inventory first: it is the half that can produce a report today. */
  const [tab, setTab] = useState<Tab>('inventory');
  const [days, setDays] = useState<number>(30);
  const [pickingPeriod, setPickingPeriod] = useState(false);
  const [history, setHistory] = useState<GeneratedReport[]>([]);

  const report = useAsync(() => generateInventoryReport(days), [days]);
  const r = report.data;

  useFocusEffect(
    useCallback(() => {
      listReports().then(setHistory);
    }, []),
  );

  const period = PERIODS.find((p) => p.days === days) ?? PERIODS[1];

  async function generate(kind: Tab) {
    const next = await recordReport({
      kind,
      name: reportName(kind),
      days,
      summary:
        kind === 'inventory' && r
          ? `${r.total_products} products · ${quantity(r.total_units)} units`
          : 'Waiting on sales history',
    });
    setHistory(next);
    router.push(`/(customer)/reports/${kind}?days=${days}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Period first, because it applies to both tabs and to the chart below them. */}
      <Pressable
        onPress={() => setPickingPeriod((v) => !v)}
        style={styles.period}
        accessibilityRole="button"
        accessibilityLabel={'Period: ' + period.label + '. Tap to change.'}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.brandInk} />
        <Text style={[text.label, styles.periodText]}>{period.label}</Text>
        <Ionicons
          name={pickingPeriod ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.brandInk}
        />
      </Pressable>

      {pickingPeriod ? (
        <View style={styles.periodList}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.days}
              onPress={() => {
                setDays(p.days);
                setPickingPeriod(false);
              }}
              style={[styles.periodOption, p.days === days && styles.periodOptionOn]}
            >
              <Text style={[text.label, p.days === days && { color: colors.accent }]}>
                {p.label}
              </Text>
              {p.days === days ? (
                <Ionicons name="checkmark" size={16} color={colors.accent} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Inventory first: it is the half that can produce a report today. */}
      <View style={styles.tabs}>
        <TabButton
          label="Inventory Reports"
          active={tab === 'inventory'}
          onPress={() => setTab('inventory')}
        />
        <TabButton label="Sales Reports" active={tab === 'sales'} onPress={() => setTab('sales')} />
      </View>

      {tab === 'inventory' ? (
        <>
          <View style={styles.tiles}>
            <Tile
              label="Reports generated"
              value={String(history.filter((h) => h.kind === 'inventory').length)}
              note={history.length > 0 ? 'on this phone' : 'none yet'}
            />
            <Tile
              label="Stock value"
              value={
                report.loading
                  ? '…'
                  : r?.total_value == null
                    ? '—'
                    : currencyShort(r.total_value)
              }
              note={r ? `${r.total_products} products` : undefined}
            />
          </View>

          <Card style={styles.gap}>
            <View style={styles.rowBetween}>
              <Text style={text.title}>Inventory overview</Text>
              <Text style={[text.caption, styles.muted]}>{period.label}</Text>
            </View>
            <ErrorBanner message={report.error} />
            {r ? (
              <>
                <TrendChart points={r.trend} />
                <View style={styles.legend}>
                  <Legend tone={colors.success} label={`${r.in_stock} in stock`} />
                  <Legend tone={colors.warning} label={`${r.low_stock} low`} />
                  <Legend tone={colors.info} label={`${r.restock_requested} requested`} />
                </View>
              </>
            ) : (
              <View style={styles.chartPlaceholder}>
                <Text style={[text.caption, styles.muted]}>
                  {report.loading ? 'Reading your stock…' : 'No stock to chart yet.'}
                </Text>
              </View>
            )}
          </Card>

          <Button
            label="Generate report"
            variant="accent"
            size="lg"
            icon="document-text-outline"
            disabled={!r || r.total_products === 0}
            onPress={() => generate('inventory')}
            fullWidth
          />
        </>
      ) : (
        <>
          <Card style={styles.gap}>
            <View style={styles.rowStart}>
              <Ionicons name="information-circle" size={18} color={colors.info} />
              <Text style={[text.bodyStrong, styles.flex]}>Waiting on sales history</Text>
            </View>
            <Text style={[text.label, styles.muted]}>
              Sales reports read what you have actually sold. Export a sales report from your POS
              and upload it, and best sellers, movement and stock-outs start filling in.
            </Text>
          </Card>

          <Button
            label="Generate report"
            variant="outline"
            size="lg"
            icon="document-text-outline"
            onPress={() => generate('sales')}
            fullWidth
          />
        </>
      )}

      <View style={styles.recent}>
        <Text style={text.title}>Recent reports</Text>
        {history.length === 0 ? (
          <Text style={[text.caption, styles.muted]}>
            Nothing generated yet. Reports you create appear here.
          </Text>
        ) : (
          history.map((h) => (
            <Card
              key={h.id}
              onPress={() => router.push(`/(customer)/reports/${h.kind}?days=${h.days}`)}
              style={styles.recentRow}
            >
              <Ionicons
                name={h.kind === 'inventory' ? 'cube-outline' : 'cart-outline'}
                size={18}
                color={colors.textMuted}
              />
              <View style={styles.flex}>
                <Text style={text.bodyStrong}>{h.name}</Text>
                <Text style={[text.caption, styles.muted]}>
                  {when(h.generated_at)} · {h.summary}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.tab, active && styles.tabOn]}
    >
      <Text style={[text.bodyStrong, { color: active ? colors.accent : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[text.caption, styles.muted]}>{label}</Text>
      <Text style={text.h2}>{value}</Text>
      {note ? <Text style={[text.caption, styles.subtle]}>{note}</Text> : null}
    </View>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[text.caption, styles.muted]}>{label}</Text>
    </View>
  );
}

/** "23 May, 14:32" — enough to tell two reports apart. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  periodText: { color: colors.brandInk },
  periodList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: -spacing.sm,
    overflow: 'hidden',
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  periodOptionOn: { backgroundColor: colors.surfaceMuted },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabOn: { borderBottomColor: colors.accent },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  gap: { gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chartPlaceholder: { height: 150, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  recent: { gap: spacing.sm },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md },
  flex: { flex: 1 },
  muted: { color: colors.textMuted },
  subtle: { color: colors.textSubtle },
});
