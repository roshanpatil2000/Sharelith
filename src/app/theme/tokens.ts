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

const fontFamily = Platform.select({ ios: 'System', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heading: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '400' },
  bodyStrong: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  amount: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  amountLarge: {
    fontFamily,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
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
