import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavTheme,
} from '@react-navigation/native';
import type { Theme } from '@/app/theme';

/** Maps Sharelith tokens onto React Navigation's theme (headers, tab bar). */
export function toNavigationTheme(t: Theme): NavTheme {
  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.colors.primary,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.textPrimary,
      border: t.colors.border,
      notification: t.colors.negative,
    },
  };
}

/** Header titles accept only family, size and weight. */
export function headerTitleStyle(t: Theme) {
  const { fontFamily, fontSize, fontWeight } = t.typography.heading;
  return { fontFamily, fontSize, fontWeight };
}
