import React from 'react';
import { Switch as RNSwitch } from 'react-native';
import { useTheme } from '@/app/theme';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
};

export function Switch(props: Props) {
  const { colors } = useTheme();
  return (
    <RNSwitch
      {...props}
      trackColor={{ false: colors.border, true: colors.primary }}
      ios_backgroundColor={colors.border}
    />
  );
}
