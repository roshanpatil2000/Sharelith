import React from 'react';
import { StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a remove "x"; used for selected participants. */
  onRemove?: () => void;
  leading?: React.ReactNode;
  testID?: string;
};

export function Chip({
  label,
  selected,
  onPress,
  onRemove,
  leading,
  testID,
}: ChipProps) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      testID={testID}
      onPress={onPress ?? onRemove}
      disabled={!onPress && !onRemove}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={onRemove && !onPress ? `Remove ${label}` : label}
      style={[styles.chip, selected && styles.selected]}
    >
      {leading}
      <Text variant="label" color={selected ? 'primary' : 'textPrimary'}>
        {label}
      </Text>
      {onRemove ? <Icon icon={X} size={14} color="textSecondary" /> : null}
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: React.ReactNode }) {
  const styles = useStyles(createStyles);
  return <View style={styles.group}>{children}</View>;
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      minHeight: 32,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    selected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primarySoft,
    },
    group: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  });
