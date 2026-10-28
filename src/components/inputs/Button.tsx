import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';
import { Row } from '../primitives/Box';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const fg =
    variant === 'primary' || variant === 'danger'
      ? colors.textOnPrimary
      : variant === 'secondary'
      ? colors.primary
      : colors.textPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      pressedStyle={
        variant === 'primary' ? styles.primaryPressed : styles.pressed
      }
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap="sm" justify="center">
          {icon ? (
            <Icon icon={icon} size={size === 'sm' ? 16 : 20} tint={fg} />
          ) : null}
          <Text
            variant={size === 'sm' ? 'label' : 'bodyStrong'}
            style={{ color: fg }}
          >
            {title}
          </Text>
        </Row>
      )}
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    sm: { minHeight: 32, paddingHorizontal: t.spacing.md },
    md: { minHeight: t.hitTarget, paddingHorizontal: t.spacing.lg },
    lg: { minHeight: 52, paddingHorizontal: t.spacing.xl },
    primary: { backgroundColor: t.colors.primary },
    primaryPressed: { backgroundColor: t.colors.primaryPressed },
    secondary: {
      backgroundColor: t.colors.primarySoft,
      borderColor: t.colors.primary,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: t.colors.danger },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.45 },
    fullWidth: { alignSelf: 'stretch' },
  });
