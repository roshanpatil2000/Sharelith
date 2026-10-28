import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme, type ColorTokens } from '@/app/theme';

type IconColor = Exclude<keyof ColorTokens, 'category'>;

export type IconProps = {
  icon: LucideIcon;
  size?: number;
  color?: IconColor;
  /** Raw color override, e.g. a category tint. */
  tint?: string;
  strokeWidth?: number;
};

export function Icon({
  icon: LucideComponent,
  size = 22,
  color = 'textPrimary',
  tint,
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  return (
    <LucideComponent
      size={size}
      color={tint ?? colors[color]}
      strokeWidth={strokeWidth}
    />
  );
}
