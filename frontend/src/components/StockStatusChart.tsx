/**
 * Stock status pie chart
 * 
 * Purpose : Three segments: In stock, Low stock, Restock requested. Tapping a segment filters the list below. See docs 07 for the Figma difference.
 * Spec    : Section 6.2
 * Look here when : Segment counts are wrong or tapping does nothing.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Card } from './ui/Card';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import type { StockStatus, StockSummary } from '../types/api';

const SIZE = 132;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Spec 6.2 defines exactly three segments. The Figma draws a fourth, "Overstock", which
 * cannot be computed because stock_items has no high_threshold column. docs/07 rules for
 * the spec, and the blue that segment used is now the Restock requested colour.
 */
const SEGMENTS: { key: StockStatus; label: string; color: string }[] = [
  { key: 'in_stock', label: 'In stock', color: colors.chart.inStock },
  { key: 'low_stock', label: 'Low stock', color: colors.chart.lowStock },
  { key: 'restock_requested', label: 'Restock requested', color: colors.chart.restockRequested },
];

interface Props {
  summary: StockSummary;
  /** Which segment is currently filtering the list, if any. */
  selected: StockStatus | null;
  onSelect: (status: StockStatus | null) => void;
}

export function StockStatusChart({ summary, selected, onSelect }: Props) {
  const counts: Record<StockStatus, number> = {
    in_stock: summary.in_stock,
    low_stock: summary.low_stock,
    restock_requested: summary.restock_requested,
  };
  const total = summary.total || 1;

  let consumed = 0;

  return (
    <Card style={styles.card}>
      <Text style={[text.title, styles.heading]}>Stock overview</Text>
      <View style={styles.body}>
        <View style={styles.chartWrap}>
          <Svg width={SIZE} height={SIZE}>
            <G rotation={-90} originX={SIZE / 2} originY={SIZE / 2}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={colors.chart.track}
                strokeWidth={STROKE}
                fill="none"
              />
              {SEGMENTS.map((seg) => {
                const value = counts[seg.key];
                if (value === 0) return null;
                const length = (value / total) * CIRCUMFERENCE;
                const offset = -consumed;
                consumed += length;
                const dimmed = selected !== null && selected !== seg.key;
                return (
                  <Circle
                    key={seg.key}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={R}
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    strokeDasharray={[length, CIRCUMFERENCE - length]}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                    opacity={dimmed ? 0.28 : 1}
                    fill="none"
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centre} pointerEvents="none">
            <Text style={text.h1}>{summary.total}</Text>
            <Text style={[text.caption, styles.muted]}>Products</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {SEGMENTS.map((seg) => {
            const value = counts[seg.key];
            const pct = ((value / total) * 100).toFixed(1);
            const active = selected === seg.key;
            return (
              <Pressable
                key={seg.key}
                onPress={() => onSelect(active ? null : seg.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.legendRow, active && styles.legendRowActive]}
              >
                <View style={[styles.dot, { backgroundColor: seg.color }]} />
                <Text style={[text.label, styles.legendLabel]} numberOfLines={1}>
                  {seg.label}
                </Text>
                <Text style={[text.label, styles.legendValue]}>
                  {value} ({pct}%)
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {selected ? (
        <Text style={[text.caption, styles.filterNote]}>
          Showing {SEGMENTS.find((s) => s.key === selected)?.label.toLowerCase()} only. Tap again to clear.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.lg },
  heading: { marginBottom: spacing.lg },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  chartWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  legend: { flex: 1, gap: spacing.xs },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  legendRowActive: { backgroundColor: colors.primaryTint },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: colors.textMuted },
  legendValue: { color: colors.text },
  filterNote: { color: colors.textSubtle, marginTop: spacing.md },
});
