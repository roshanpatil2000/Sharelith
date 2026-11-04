import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';

export type SwipeAction = {
  label: string;
  icon: LucideIcon;
  tone: 'primary' | 'danger';
  onPress: () => void;
  testID?: string;
};

type Props = {
  children: React.ReactNode;
  /** Revealed by swiping right. */
  startAction?: SwipeAction;
  /** Revealed by swiping left. */
  endAction?: SwipeAction;
};

/**
 * A row with actions behind it. Give the row itself the same actions as
 * accessibilityActions: screen readers can't swipe a row open.
 */
export function SwipeRow({ children, startAction, endAction }: Props) {
  const styles = useStyles(createStyles);
  const swipeable = useRef<SwipeableMethods>(null);

  // A gesture-handler button: the swipe owns the touch, so a plain
  // Pressable behind it never sees the tap on Android.
  const renderAction = (action: SwipeAction) => (
    <RectButton
      testID={action.testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => {
        action.onPress();
        swipeable.current?.close?.();
      }}
      style={[styles.action, styles[action.tone]]}
    >
      <Icon icon={action.icon} color="textOnPrimary" />
      <Text variant="caption" color="textOnPrimary">
        {action.label}
      </Text>
    </RectButton>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        startAction ? () => renderAction(startAction) : undefined
      }
      renderRightActions={endAction ? () => renderAction(endAction) : undefined}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    action: {
      width: 88,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xxs,
    },
    primary: { backgroundColor: t.colors.primary },
    danger: { backgroundColor: t.colors.danger },
  });
