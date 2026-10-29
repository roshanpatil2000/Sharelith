import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** 4-pt spacing scale. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;
export type SpacingKey = keyof typeof spacing;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;
export type RadiusKey = keyof typeof radius;

/**
 * Android's default font (Roboto) only renders 400 and 700 from fontWeight;
 * 500/600 fall back to regular. Use the named medium family there instead.
 */
const regular: TextStyle = Platform.select({
  ios: { fontFamily: 'System', fontWeight: '400' },
  default: { fontFamily: 'sans-serif', fontWeight: 'normal' },
});
const semibold: TextStyle = Platform.select({
  ios: { fontFamily: 'System', fontWeight: '600' },
  default: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' },
});
const bold: TextStyle = Platform.select({
  ios: { fontFamily: 'System', fontWeight: '700' },
  default: { fontFamily: 'sans-serif', fontWeight: 'bold' },
});

export const typography = {
  display: { ...bold, fontSize: 28, lineHeight: 34 },
  title: { ...bold, fontSize: 20, lineHeight: 26 },
  heading: { ...semibold, fontSize: 17, lineHeight: 22 },
  body: { ...regular, fontSize: 15, lineHeight: 20 },
  bodyStrong: { ...semibold, fontSize: 15, lineHeight: 20 },
  caption: { ...regular, fontSize: 13, lineHeight: 18 },
  label: { ...semibold, fontSize: 13, lineHeight: 18 },
  amount: {
    ...semibold,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  amountLarge: {
    ...bold,
    fontSize: 34,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;
export type TypographyVariant = keyof typeof typography;

/** Platform-correct shadows, levels 0–3. */
export const elevation: Record<0 | 1 | 2 | 3, ViewStyle> = {
  0: {},
  1: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    default: { elevation: 1 },
  }),
  2: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    default: { elevation: 4 },
  }),
  3: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 8 },
  }),
};

export const zIndex = { base: 0, sticky: 10, fab: 20, overlay: 30, toast: 40 };

export const motion = {
  duration: { fast: 120, normal: 220, slow: 350 },
  spring: { damping: 18, stiffness: 220, mass: 1 },
} as const;

/** Minimum touch target (Apple HIG / Material). */
export const hitTarget = 44;
