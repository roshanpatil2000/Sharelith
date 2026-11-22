import React from 'react';
import { StyleSheet } from 'react-native';
import { Receipt, type LucideIcon } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';
import { useTabBarSpace } from './TabBarSpace';

type Props = {
  label?: string;
  icon?: LucideIcon;
  onPress: () => void;
  /** Distance from the bottom edge, or from the floating tab bar on tabs. */
  bottom?: number;
  testID?: string;
};

/** Extended floating action button — "Add expense". */
export function FAB({
  label = 'Add expense',
  icon = Receipt,
  onPress,
  bottom = 16,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const tabBarSpace = useTabBarSpace();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.fab, { bottom: bottom + tabBarSpace }]}
      pressedStyle={styles.pressed}
      ripple={colors.primaryPressed}
    >
      <Icon icon={icon} size={20} tint={colors.textOnPrimary} />
      <Text variant="bodyStrong" color="textOnPrimary">
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    fab: {
      position: 'absolute',
      right: t.spacing.lg,
      zIndex: t.zIndex.fab,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      height: 52,
      paddingHorizontal: t.spacing.xl,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.primary,
      ...t.elevation[3],
    },
    pressed: { backgroundColor: t.colors.primaryPressed },
  });
