import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ColorTokens } from './colors';
import {
  elevation,
  hitTarget,
  motion,
  radius,
  spacing,
  typography,
  zIndex,
} from './tokens';
import { useSettingsStore, type ThemePreference } from '@/lib/settingsStore';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  zIndex: typeof zIndex;
  motion: typeof motion;
  hitTarget: number;
};

export function buildTheme(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    elevation,
    zIndex,
    motion,
    hitTarget,
  };
}

const ThemeContext = createContext<Theme>(buildTheme('light'));

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): 'light' | 'dark' {
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}

type Props = {
  children: React.ReactNode;
  /** Forces a scheme; used by tests and the component gallery. */
  scheme?: 'light' | 'dark';
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const preference = useSettingsStore(s => s.themePreference);
  const resolved = scheme ?? resolveScheme(preference, system);
  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
