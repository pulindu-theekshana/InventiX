/**
 * Trend chart
 *
 * Purpose : A line of one value over time, for the inventory report. Drawn with react-native-svg, which the stock pie chart already uses, so this adds no dependency.
 * Spec    : Section 7.1
 * Look here when : The report line is flat, clipped, or its labels disagree with the figures below it.
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { text } from '../theme/typography';
import type { TrendPoint } from '../types/api';

interface Props {
  points: TrendPoint[];
  /** Named so the axis labels can say what the numbers are, not just what they measure. */
  unitLabel?: string;
}

const HEIGHT = 150;
/** Room for the value labels on the left, so the line never sits under them. */
const PAD_LEFT = 44;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export function TrendChart({ points, unitLabel = 'units' }: Props) {
  /** Measured rather than assumed: the card width differs between phones. */
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <Text style={[text.caption, styles.muted]}>
        Not enough history yet to draw a line.
      </Text>
    );
  }

  const values = points.map((p) => p.total_units);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  /**
   * A flat line would divide by zero and, worse, render along one edge. Padding the range
   * puts a genuinely unchanged total through the middle of the card instead.
   */
  const max = rawMax === rawMin ? rawMax + Math.max(1, Math.round(rawMax * 0.1)) : rawMax;
  const min = rawMax === rawMin ? Math.max(0, rawMin - Math.max(1, Math.round(rawMax * 0.1))) : rawMin;

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_LEFT + (i / (points.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.total_units)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${PAD_TOP + plotH} L ${x(0)} ${PAD_TOP + plotH} Z`;

  const last = points[points.length - 1];
  const first = points[0];
  const change = last.total_units - first.total_units;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {/* Three gridlines, each labelled with a value the line actually reaches. */}
          {[0, 0.5, 1].map((t) => {
            const value = Math.round(max - t * (max - min));
            return (
              <Line
                key={t}
                x1={PAD_LEFT}
                x2={PAD_LEFT + plotW}
                y1={PAD_TOP + t * plotH}
                y2={PAD_TOP + t * plotH}
                stroke={colors.border}
                strokeWidth={1}
                strokeDasharray={t === 1 ? undefined : '3 4'}
                opacity={value === undefined ? 0 : 1}
              />
            );
          })}
          <Path d={area} fill={colors.accent} opacity={0.08} />
          <Path
            d={line}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* The end point is emphasised because it is the number the reader came for. */}
          <Circle cx={x(points.length - 1)} cy={y(last.total_units)} r={4.5} fill={colors.accent} />
          <Circle cx={x(points.length - 1)} cy={y(last.total_units)} r={8} fill={colors.accent} opacity={0.18} />
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}

      {/* Labels sit in React Native text rather than SVG text, so they use the app's font. */}
      <View style={styles.yAxis} pointerEvents="none">
        <Text style={[text.caption, styles.axisText]}>{Math.round(max)}</Text>
        <Text style={[text.caption, styles.axisText]}>{Math.round((max + min) / 2)}</Text>
        <Text style={[text.caption, styles.axisText]}>{Math.round(min)}</Text>
      </View>

      <View style={styles.xAxis}>
        <Text style={[text.caption, styles.muted]}>{shortDate(first.date)}</Text>
        <Text style={[text.caption, styles.muted]}>
          {change === 0
            ? `No change over ${points.length} days`
            : `${change > 0 ? '+' : ''}${change} ${unitLabel} over ${points.length} days`}
        </Text>
        <Text style={[text.caption, styles.muted]}>{shortDate(last.date)}</Text>
      </View>
    </View>
  );
}

/** 17 Aug — the year is never in doubt across a 30 day window. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted },
  axisText: { color: colors.textSubtle, fontSize: 11 },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: PAD_TOP - 7,
    height: HEIGHT - PAD_TOP - PAD_BOTTOM + 14,
    width: PAD_LEFT - 6,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
});
