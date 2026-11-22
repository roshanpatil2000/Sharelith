import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/app/theme';

type Props = {
  children: React.ReactNode;
  /** rise: up a little while fading in. grow: out of the bottom-right, where the Add expense button is. */
  from?: 'rise' | 'grow';
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Animates its children in once, when mounted. Reanimated skips it when the
 * phone's Reduce Motion is on.
 */
export function Appear({ children, from = 'rise', delay = 0, style }: Props) {
  const { motion } = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: motion.duration.normal }),
    );
  }, [progress, delay, motion.duration.normal]);
  const grow = from === 'grow';
  const animated = useAnimatedStyle(() => {
    const left = 1 - progress.value;
    return {
      opacity: progress.value,
      transform: grow
        ? [
            { translateX: left * 36 },
            { translateY: left * 90 },
            { scale: 1 - left * 0.18 },
          ]
        : [{ translateY: left * 16 }],
    };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
