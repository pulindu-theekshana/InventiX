/**
 * Spacing scale
 * 
 * Purpose : Consistent padding, gaps, corner radii and elevation. A 4pt scale, so every gap in the app is a multiple of 4 and nothing is eyeballed.
 * Spec    : -
 * Look here when : Layouts feel uneven.
 */

import { Platform, type ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Standard horizontal page gutter. Every screen uses this so edges line up. */
export const screenPadding = spacing.lg;

/**
 * Soft elevation instead of 1px borders. iOS and Android express shadow differently,
 * so this returns the right props for the platform rather than making each component guess.
 */
export function elevation(level: 0 | 1 | 2 | 3): ViewStyle {
  if (level === 0) return {};
  const ios = {
    1: { shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    2: { shadowOpacity: 0.09, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    3: { shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  }[level];
  return Platform.OS === 'ios'
    ? { shadowColor: '#000', ...ios }
    : { elevation: level * 2 };
}
