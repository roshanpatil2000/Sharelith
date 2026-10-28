import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/app/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders with theme + safe-area providers, like the real app root.
 * Async (Testing Library v14): `await renderWithTheme(...)`.
 */
export function renderWithTheme(
  ui: React.ReactElement,
  { scheme = 'light' }: { scheme?: 'light' | 'dark' } = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider scheme={scheme}>{children}</ThemeProvider>
      </SafeAreaProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
