/**
 * Brand colours
 * 
 * Purpose : Yellow FFD94D, deep amber 9D600B, ink 501602, plus the status and chart colours. Every colour in the app comes from here. Sampled from the Figma file, not invented.
 * Spec    : -
 * Look here when : A colour is inconsistent with the brand guide.
 */

/** Raw values. Nothing outside this file should use these directly — use `colors` below. */
const palette = {
  yellow: '#FFD94D',
  yellowPressed: '#F0C733',
  yellowTint: '#FFF4D8',

  amber: '#9D600B',
  amberPressed: '#7E4D09',
  amberTint: '#F7DDA5',

  ink: '#501602',

  green: '#1CB24F',
  greenSend: '#26963B',
  greenTint: '#CFFEC7',

  warn: '#FEB502',
  warnTint: '#F7DDA5',

  danger: '#FB3A36',
  dangerTint: '#FEE2E1',

  info: '#0B7DF5',
  infoTint: '#DCEBFD',

  white: '#FFFFFF',
  grey50: '#FAFAFA',
  grey100: '#F2F2F2',
  grey200: '#E6E6E6',
  grey300: '#D9D9D9',
  grey500: '#8A8A8A',
  grey700: '#5A5A5A',
  grey900: '#1F1F1F',
} as const;

export const colors = {
  /** Screen background behind cards. */
  background: palette.grey50,
  /** Card and sheet surfaces. */
  surface: palette.white,
  /** A quieter surface, for message previews and read-only blocks. */
  surfaceMuted: palette.grey100,
  /** Hairlines. Prefer elevation over borders; use this only where a rule is genuinely needed. */
  border: palette.grey200,

  /** The app bar, splash and primary fills. */
  primary: palette.yellow,
  primaryPressed: palette.yellowPressed,
  primaryTint: palette.yellowTint,
  /** Text and icons sitting on `primary`. */
  onPrimary: palette.ink,

  /** Solid action buttons — Login, Add product, Edit message. */
  accent: palette.amber,
  accentPressed: palette.amberPressed,
  onAccent: palette.white,

  text: palette.grey900,
  textMuted: palette.grey700,
  textSubtle: palette.grey500,
  textOnDark: palette.white,
  /** Headings inside the yellow app bar, and the wordmark. */
  brandInk: palette.ink,

  success: palette.green,
  successBg: palette.greenTint,
  /** The Send button specifically — a slightly deeper green than the badge. */
  send: palette.greenSend,

  warning: palette.warn,
  warningBg: palette.warnTint,

  danger: palette.danger,
  dangerBg: palette.dangerTint,

  info: palette.info,
  infoBg: palette.infoTint,

  disabled: palette.grey300,
  onDisabled: palette.grey500,

  /**
   * Stock status pie chart — three segments only.
   * Spec 6.2 defines three; the Figma draws a fourth ("Overstock") that cannot be
   * computed because there is no high_threshold column. See docs/07-design-vs-spec.md.
   */
  chart: {
    inStock: palette.green,
    lowStock: palette.warn,
    restockRequested: palette.info,
    track: palette.grey200,
  },
} as const;

export type ColorToken = keyof typeof colors;
