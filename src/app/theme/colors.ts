/**
 * Sharelith color palette. Screens and components read these through
 * `useTheme().colors` — never hard-code hex values elsewhere.
 *
 * Money semantics: positive = you are owed, negative = you owe,
 * neutral = settled up.
 */

export const categoryKeys = [
  'food',
  'home',
  'transport',
  'entertainment',
  'utilities',
  'life',
  'travel',
  'general',
] as const;

export type CategoryKey = (typeof categoryKeys)[number];

/**
 * Avatar backgrounds, shared by both schemes so a person keeps one color.
 * Each passes 4.5:1 contrast against white initials.
 */
export const avatarColors = [
  '#1A7F6B',
  '#2F6FAE',
  '#5151C6',
  '#A8327F',
  '#C2410C',
  '#0B7A84',
  '#6D48D6',
  '#4B5563',
] as const;

export type ColorTokens = {
  /** Brand: filled buttons, FAB, switches, active tab, focus rings. */
  primary: string;
  primaryPressed: string;
  /** Selected backgrounds (chips, segmented track, pressed rows, banners). */
  primarySoft: string;
  /** Stronger teal surface for secondary emphasis. */
  primaryTint: string;
  /**
   * Teal for small text/icons on tinted backgrounds. In light mode the brand
   * teal is only 4.1–4.3:1 on primarySoft/background, so this is darker.
   */
  primaryText: string;
  accent: string;
  positive: string;
  negative: string;
  danger: string;
  warning: string;
  neutral: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textOnPrimary: string;
  overlay: string;
  category: Record<CategoryKey, string>;
};

// Brand teal #00838A. Light: bright surfaces, teal accents.
export const lightColors: ColorTokens = {
  primary: '#00838A',
  primaryPressed: '#006A6F',
  primarySoft: '#E6F6F7',
  primaryTint: '#C8EDED',
  primaryText: '#006A6F',
  accent: '#5B5BD6',
  positive: '#006A6F',
  negative: '#E8642C',
  danger: '#D93A3A',
  warning: '#E0A400',
  neutral: '#8A9099',
  background: '#F7FAFA',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#D9E4E5',
  textPrimary: '#172B2D',
  textSecondary: '#5F7072',
  textOnPrimary: '#FFFFFF',
  overlay: 'rgba(15, 18, 20, 0.45)',
  category: {
    food: '#E8642C',
    home: '#3B82C4',
    transport: '#5B5BD6',
    entertainment: '#C2459B',
    utilities: '#E0A400',
    life: '#1E9E83',
    travel: '#0E9AA7',
    general: '#8A9099',
  },
};

// Dark: deep teal surfaces with a brighter teal (#26B8B8) for interactions.
export const darkColors: ColorTokens = {
  primary: '#26B8B8',
  primaryPressed: '#5FCFCB',
  primarySoft: '#123C3E',
  primaryTint: '#16494B',
  primaryText: '#26B8B8',
  accent: '#8B8BF0',
  positive: '#26B8B8',
  negative: '#FF8A50',
  danger: '#FF6B6B',
  warning: '#F5C542',
  neutral: '#7C838C',
  background: '#0B1516',
  surface: '#142224',
  surfaceRaised: '#142224',
  border: '#304345',
  textPrimary: '#F2F7F7',
  textSecondary: '#A6B8B9',
  textOnPrimary: '#0B1516',
  overlay: 'rgba(0, 0, 0, 0.6)',
  category: {
    food: '#FF9A66',
    home: '#6AAAE3',
    transport: '#8B8BF0',
    entertainment: '#E57BC4',
    utilities: '#F5C542',
    life: '#34C7A5',
    travel: '#3FC3CE',
    general: '#A5ADB4',
  },
};
