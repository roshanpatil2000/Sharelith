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
  primary: string;
  primaryPressed: string;
  primarySoft: string;
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

export const lightColors: ColorTokens = {
  primary: '#1E9E83',
  primaryPressed: '#16806A',
  primarySoft: '#E3F5F0',
  accent: '#5B5BD6',
  positive: '#1E9E83',
  negative: '#E8642C',
  danger: '#D93A3A',
  warning: '#E0A400',
  neutral: '#8A9099',
  background: '#FFFFFF',
  surface: '#F6F7F8',
  surfaceRaised: '#FFFFFF',
  border: '#E3E6E9',
  textPrimary: '#15191C',
  textSecondary: '#5E666E',
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

export const darkColors: ColorTokens = {
  primary: '#34C7A5',
  primaryPressed: '#2AA88B',
  primarySoft: '#13332C',
  accent: '#8B8BF0',
  positive: '#34C7A5',
  negative: '#FF8A50',
  danger: '#FF6B6B',
  warning: '#F5C542',
  neutral: '#7C838C',
  background: '#0F1214',
  surface: '#181C1F',
  surfaceRaised: '#20252A',
  border: '#2B3136',
  textPrimary: '#F2F4F5',
  textSecondary: '#A5ADB4',
  textOnPrimary: '#0F1214',
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
