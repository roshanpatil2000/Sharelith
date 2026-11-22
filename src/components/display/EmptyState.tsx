import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';
import { Button } from '../inputs/Button';
import { Appear } from '../motion/Appear';

type Props = {
  icon: LucideIcon;
  /** An illustration to show instead of the icon. */
  art?: React.ReactNode;
  actionIcon?: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  art,
  actionIcon,
  title,
  message,
  actionLabel,
  onAction,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <Appear style={styles.container}>
      {art ? (
        <View
          style={styles.art}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {art}
        </View>
      ) : (
        <View style={styles.iconWrap}>
          <Icon icon={icon} size={36} color="primary" />
        </View>
      )}
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          icon={actionIcon}
          variant="outline"
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </Appear>
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
    art: {
      width: 200,
      height: 200,
      padding: t.spacing.md,
      borderRadius: 100,
      backgroundColor: t.colors.primarySoft,
      marginBottom: t.spacing.md,
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
