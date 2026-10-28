import React from 'react';
import { StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, type ColorTokens, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Icon } from '../primitives/Icon';

type Props = {
  icon: LucideIcon;
  /** Required: icon-only buttons need a screen-reader label. */
  accessibilityLabel: string;
  onPress?: () => void;
  color?: Exclude<keyof ColorTokens, 'category'>;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = 'textPrimary',
  size = 22,
  filled = false,
  disabled,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        filled && styles.filled,
        disabled && styles.disabled,
      ]}
    >
      <Icon icon={icon} size={size} color={color} />
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      width: t.hitTarget,
      height: t.hitTarget,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filled: { backgroundColor: t.colors.surface },
    disabled: { opacity: 0.4 },
  });
