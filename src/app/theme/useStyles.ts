import { useMemo } from 'react';
import { useTheme, type Theme } from './ThemeProvider';

/**
 * Builds a StyleSheet from the active theme, recomputed only when the theme
 * changes. Define the factory at module scope:
 *
 *   const createStyles = (t: Theme) => StyleSheet.create({ ... });
 *   const styles = useStyles(createStyles);
 */
export function useStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
