import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';

type Props = {
  label: string | number;
  tone?: 'primary' | 'accent' | 'danger' | 'neutral';
};

/** Small pill: "PRO", unread counts, "Settled". */
export function Badge({ label, tone = 'primary' }: Props) {
  const styles = useStyles(createStyles);
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text variant="caption" color="textOnPrimary" style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    badge: {
      minWidth: 20,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xxs,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    text: { fontWeight: '700' },
    primary: { backgroundColor: t.colors.primary },
    accent: { backgroundColor: t.colors.accent },
    danger: { backgroundColor: t.colors.danger },
    neutral: { backgroundColor: t.colors.neutral },
  });
