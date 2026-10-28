import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';
import { Button } from '../inputs/Button';

type Props = {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon icon={icon} size={36} color="primary" />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xxxl,
      gap: t.spacing.sm,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.sm,
    },
    action: { marginTop: t.spacing.md },
  });
