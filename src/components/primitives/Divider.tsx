import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme, type SpacingKey } from '@/app/theme';

type Props = {
  /** Left inset, e.g. to align with list-row text after an avatar. */
  inset?: SpacingKey | number;
};

export function Divider({ inset = 'none' }: Props) {
  const t = useTheme();
  const marginLeft = typeof inset === 'number' ? inset : t.spacing[inset];
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: t.colors.border,
        marginLeft,
      }}
    />
  );
}
