import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';

/** Blocks interaction while a mutation (e.g. saving an expense) is in flight. */
export function LoadingOverlay({ visible }: { visible: boolean }) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  if (!visible) {
    return null;
  }
  return (
    <View
      style={styles.overlay}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: t.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: t.zIndex.overlay,
    },
  });
