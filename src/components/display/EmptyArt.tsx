import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { avatarColors, useTheme } from '@/app/theme';

const [green, blue, indigo, pink, orange] = avatarColors;

function Head({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={12} fill={color} />
      <Path d={`M${x - 20} ${y + 42} a20 24 0 0 1 40 0 Z`} fill={color} />
    </G>
  );
}

/** People under one roof. */
export function GroupsArt() {
  const { colors } = useTheme();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 180 180">
      <Path d="M22 80 L90 26 L158 80 V152 H22 Z" fill={colors.surface} />
      <Path
        d="M14 84 L90 22 L166 84"
        fill="none"
        stroke={colors.primary}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Head x={56} y={102} color={orange} />
      <Head x={124} y={102} color={blue} />
      <Head x={90} y={92} color={green} />
    </Svg>
  );
}

/** Two friends, and room for another. */
export function FriendsArt() {
  const { colors } = useTheme();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 180 180">
      <Rect
        x={14}
        y={48}
        width={152}
        height={100}
        rx={24}
        fill={colors.surface}
      />
      <Head x={54} y={82} color={indigo} />
      <Head x={98} y={82} color={pink} />
      <Circle cx={144} cy={54} r={24} fill={colors.primary} />
      <Path
        d="M144 43 V65 M133 54 H155"
        stroke={colors.textOnPrimary}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
