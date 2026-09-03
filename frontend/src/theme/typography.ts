/**
 * Typography
 * 
 * Purpose : The size, weight and line-height scale, and the named text styles built from it.
 * Spec    : -
 * Look here when : Text sizes are inconsistent.
 */

import { Platform, TextStyle } from 'react-native';

/**
 * ponytail: system font, not Inter. Inter needs expo-font plus a webfont package and an
 * async load gate at startup, which would tangle with the session-restore splash in
 * app/_layout.tsx. The system face is San Francisco on iOS and Roboto on Android, both of
 * which read as modern and cost nothing. Swap to Inter via @expo-google-fonts/inter if the
 * brand requires it — only this file changes.
 */
export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 30,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const text = {
  display: { fontFamily, fontSize: fontSize.display, fontWeight: fontWeight.bold, lineHeight: 36 },
  h1: { fontFamily, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, lineHeight: 30 },
  h2: { fontFamily, fontSize: fontSize.xl, fontWeight: fontWeight.semibold, lineHeight: 26 },
  title: { fontFamily, fontSize: fontSize.lg, fontWeight: fontWeight.semibold, lineHeight: 23 },
  body: { fontFamily, fontSize: fontSize.md, fontWeight: fontWeight.regular, lineHeight: 21 },
  bodyStrong: { fontFamily, fontSize: fontSize.md, fontWeight: fontWeight.semibold, lineHeight: 21 },
  label: { fontFamily, fontSize: fontSize.sm, fontWeight: fontWeight.medium, lineHeight: 18 },
  caption: { fontFamily, fontSize: fontSize.xs, fontWeight: fontWeight.medium, lineHeight: 15 },
} as const satisfies Record<string, TextStyle>;
