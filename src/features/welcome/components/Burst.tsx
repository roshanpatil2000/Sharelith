import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { avatarColors, useTheme } from '@/app/theme';
import { AuthLogo } from '@/features/auth/components/AuthLogo';

const COUNT = 14;

function Piece({ index }: { index: number }) {
  const out = useSharedValue(0);
  useEffect(() => {
    out.value = withSpring(1, { damping: 11, stiffness: 70, mass: 0.8 });
  }, [out]);
  const angle = (index / COUNT) * Math.PI * 2;
  const distance = index % 2 ? 72 : 92;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;
  const spin = index * 47;
  const move = useAnimatedStyle(() => ({
    opacity: out.value,
    transform: [
      { translateX: x * out.value },
      { translateY: y * out.value },
      { rotate: `${spin * out.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        index % 3 === 0 && styles.dot,
        { backgroundColor: avatarColors[index % avatarColors.length] },
        move,
      ]}
    />
  );
}

/** The logo, with a little confetti bursting from behind it. */
export function Burst() {
  const { motion } = useTheme();
  const scale = useSharedValue(0.6);
  useEffect(() => {
    scale.value = withSpring(1, motion.spring);
  }, [scale, motion.spring]);
  const grow = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <View
      style={styles.stage}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: COUNT }, (_, index) => (
        <Piece key={index} index={index} />
      ))}
      <Animated.View style={grow}>
        <AuthLogo />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
  },
  piece: { position: 'absolute', width: 8, height: 14, borderRadius: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
