import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  testID?: string;
};

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? (
          <Icon
            icon={Check}
            size={16}
            tint={colors.textOnPrimary}
            strokeWidth={3}
          />
        ) : null}
      </View>
      {label ? <Text>{label}</Text> : null}
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: t.hitTarget,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: t.radius.sm,
      borderWidth: 2,
      borderColor: t.colors.neutral,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checked: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
  });
