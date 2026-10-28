import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import {
  useTheme,
  type ColorTokens,
  type TypographyVariant,
} from '@/app/theme';

type TextColor = Exclude<keyof ColorTokens, 'category'>;

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: 'left' | 'center' | 'right';
};

export function Text({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  ...rest
}: TextProps) {
  const { typography, colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
