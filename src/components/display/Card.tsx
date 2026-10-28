import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';

type Props = ViewProps & { elevated?: boolean };

export function Card({ elevated = false, style, ...rest }: Props) {
  const styles = useStyles(createStyles);
  return (
    <View {...rest} style={[styles.card, elevated && styles.elevated, style]} />
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      padding: t.spacing.lg,
    },
    elevated: { ...t.elevation[2], borderWidth: 0 },
  });
