import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';

type Props = { title: string; action?: React.ReactNode };

/** List section header, e.g. month names in an expense list. */
export function SectionHeader({ title, action }: Props) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.header} accessibilityRole="header">
      <Text variant="label" color="textSecondary" style={styles.title}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.surface,
    },
    title: { textTransform: 'uppercase', letterSpacing: 0.5 },
  });
