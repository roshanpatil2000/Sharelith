import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { avatarColors, useTheme } from '@/app/theme';

/** A round avatar of a person, drawn around (x, y). */
function Person({
  x,
  y,
  r,
  color,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
}) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={color} />
      <Circle cx={x} cy={y - r * 0.22} r={r * 0.3} fill="#FFFFFF" />
      <Path
        d={`M${x - r * 0.55} ${y + r * 0.66} a${r * 0.55} ${r * 0.53} 0 0 1 ${
          r * 1.1
        } 0 a${r * 0.95} ${r * 0.95} 0 0 1 ${-r * 1.1} 0 Z`}
        fill="#FFFFFF"
      />
    </G>
  );
}

const [green, blue, indigo, pink, orange] = avatarColors;

/** The split coin from the logo, with friends around it. */
export function TogetherArt() {
  const { colors } = useTheme();
  const friends = [
    { x: 160, y: 40, color: orange },
    { x: 274, y: 123, color: blue },
    { x: 230, y: 257, color: pink },
    { x: 90, y: 257, color: indigo },
    { x: 46, y: 123, color: green },
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 300">
      <Circle cx={160} cy={160} r={120} fill={colors.surface} opacity={0.45} />
      <Circle
        cx={160}
        cy={160}
        r={120}
        fill="none"
        stroke={colors.primary}
        strokeWidth={3}
        strokeDasharray="3 10"
        strokeLinecap="round"
      />
      <Path d="M154 102 A58 58 0 0 0 154 218 Z" fill={colors.primary} />
      <Path
        d="M166 98 A58 58 0 0 1 166 214 Z"
        fill={colors.primary}
        opacity={0.45}
      />
      {friends.map(f => (
        <Person key={f.color} x={f.x} y={f.y} r={30} color={f.color} />
      ))}
    </Svg>
  );
}

/** A bill, each line going to whoever had it. */
export function SplitArt() {
  const { colors } = useTheme();
  const lines = [
    { y: 92, length: 70, color: orange, to: 56 },
    { y: 142, length: 48, color: blue, to: 150 },
    { y: 192, length: 60, color: pink, to: 244 },
  ];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 300">
      <Path
        d="M22 22 H184 V262 L164 276 L144 262 L124 276 L104 262 L83 276 L63 262 L42 276 L22 262 Z"
        fill={colors.surface}
      />
      <Rect
        x={42}
        y={44}
        width={84}
        height={12}
        rx={6}
        fill={colors.textPrimary}
      />
      {lines.map(line => (
        <G key={line.color}>
          <Circle cx={54} cy={line.y} r={12} fill={line.color} />
          <Rect
            x={74}
            y={line.y - 5}
            width={line.length}
            height={10}
            rx={5}
            fill={colors.border}
          />
          <Path
            d={`M170 ${line.y} C220 ${line.y} 210 ${line.to} 250 ${line.to}`}
            fill="none"
            stroke={line.color}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx={170} cy={line.y} r={5} fill={line.color} />
          <Person x={276} y={line.to} r={30} color={line.color} />
        </G>
      ))}
      <Line
        x1={42}
        y1={222}
        x2={164}
        y2={222}
        stroke={colors.border}
        strokeWidth={3}
        strokeDasharray="5 6"
      />
      <Rect
        x={96}
        y={238}
        width={68}
        height={12}
        rx={6}
        fill={colors.primary}
      />
    </Svg>
  );
}

/** A tangle of debts becoming one payment, and all square. */
export function SettleArt() {
  const { colors } = useTheme();
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 300">
      <Path
        d="M64 62 C120 132 210 -8 256 62 M64 62 C150 -14 110 142 160 78 C200 28 208 132 256 62"
        fill="none"
        stroke={colors.textSecondary}
        strokeOpacity={0.35}
        strokeWidth={3}
        strokeDasharray="6 7"
        strokeLinecap="round"
      />
      <Person x={52} y={62} r={28} color={indigo} />
      <Person x={268} y={62} r={28} color={orange} />
      <Path
        d="M160 118 V144 M150 135 L160 146 L170 135"
        fill="none"
        stroke={colors.textSecondary}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect
        x={12}
        y={164}
        width={296}
        height={124}
        rx={28}
        fill={colors.surface}
      />
      <Person x={62} y={226} r={32} color={indigo} />
      <Person x={258} y={226} r={32} color={orange} />
      <Path
        d="M104 226 H214 M203 215 L216 226 L203 237"
        fill="none"
        stroke={colors.primary}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={156} cy={226} r={24} fill={colors.primary} />
      <Path
        d="M145 226 L153 234 L168 218"
        fill="none"
        stroke={colors.textOnPrimary}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
