import React, { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useStyles, type Theme } from '@/app/theme';
import { Row, Stack } from '../primitives/Box';

type Props = {
  width?: DimensionValue;
  height?: number;
  circle?: boolean;
};

export function Skeleton({
  width = '100%',
  height = 14,
  circle = false,
}: Props) {
  const styles = useStyles(createStyles);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width: circle ? height : width, height },
        circle && { borderRadius: height / 2 },
        animated,
      ]}
    />
  );
}

/** Placeholder matching ListRow's layout. */
export function ListRowSkeleton() {
  return (
    <Row gap="md" px="lg" py="md">
      <Skeleton circle height={40} />
      <Stack flex={1} gap="xs">
        <Skeleton width="55%" />
        <Skeleton width="35%" height={12} />
      </Stack>
      <Skeleton width={64} />
    </Row>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    block: { backgroundColor: t.colors.border, borderRadius: t.radius.sm },
  });
