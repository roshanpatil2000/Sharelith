import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CircleAlert,
  Info,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';
import { Pressable } from '../primitives/Pressable';

type Tone = 'info' | 'warning' | 'danger' | 'offline';
const icons: Record<Tone, LucideIcon> = {
  info: Info,
  warning: CircleAlert,
  danger: CircleAlert,
  offline: WifiOff,
};

type Props = {
  message: string;
  tone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
};

/** Inline, non-blocking notice: offline mode, settle-up reminders, errors. */
export function Banner({
  message,
  tone = 'info',
  actionLabel,
  onAction,
}: Props) {
  const styles = useStyles(createStyles);
  const color =
    tone === 'danger' ? 'danger' : tone === 'info' ? 'primaryText' : 'warning';
  return (
    <View style={[styles.banner, styles[tone]]} accessibilityRole="alert">
      <Icon icon={icons[tone]} size={18} color={color} />
      <Text variant="caption" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityLabel={actionLabel}>
          <Text variant="label" color={color}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: 1,
    },
    message: { flex: 1 },
    info: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    warning: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.warning,
    },
    offline: {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.warning,
    },
    danger: { backgroundColor: t.colors.surface, borderColor: t.colors.danger },
  });
