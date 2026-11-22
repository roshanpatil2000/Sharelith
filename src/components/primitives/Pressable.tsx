import React from 'react';
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type PressableProps = Omit<RNPressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Style merged in while pressed; defaults to a subtle fade. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Android's ripple in this color, spreading from the touch. */
  ripple?: string;
};

const defaultPressed: ViewStyle = { opacity: 0.6 };

export function Pressable({
  style,
  pressedStyle = defaultPressed,
  disabled,
  ripple,
  accessibilityRole = 'button',
  accessibilityState,
  ...rest
}: PressableProps) {
  return (
    <RNPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      android_ripple={ripple ? { color: ripple } : undefined}
      hitSlop={rest.hitSlop ?? 4}
      style={({ pressed }) => [style, pressed && !disabled && pressedStyle]}
    />
  );
}
