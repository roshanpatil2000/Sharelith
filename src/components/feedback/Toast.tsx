import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useStyles, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

type ToastTone = 'success' | 'error' | 'info';
/** A button on the toast, such as Undo. */
export type ToastAction = { label: string; onPress: () => void };
type ToastState = {
  message: string | null;
  tone: ToastTone;
  action: ToastAction | null;
  id: number;
  show: (message: string, tone?: ToastTone, action?: ToastAction) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>(set => ({
  message: null,
  tone: 'info',
  action: null,
  id: 0,
  show: (message, tone = 'info', action) =>
    set(s => ({ message, tone, action: action ?? null, id: s.id + 1 })),
  hide: () => set({ message: null, action: null }),
}));

/** Call from anywhere: `toast.show('Expense saved', 'success')`. */
export const toast = {
  show: (message: string, tone?: ToastTone, action?: ToastAction) =>
    useToastStore.getState().show(message, tone, action),
};

/** Mount once at the app root. */
export function ToastHost() {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { message, tone, action, id, hide } = useToastStore();

  useEffect(() => {
    if (!message) {
      return;
    }
    // Longer when there's a button to reach.
    const timer = setTimeout(hide, action ? 5000 : 2800);
    return () => clearTimeout(timer);
  }, [message, action, id, hide]);

  if (!message) {
    return null;
  }
  return (
    <Animated.View
      key={id}
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.toast, styles[tone], { top: insets.top + 8 }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text variant="bodyStrong" color="textOnPrimary" style={styles.message}>
        {message}
      </Text>
      {action ? (
        <Pressable
          testID="toast-action"
          accessibilityLabel={action.label}
          onPress={() => {
            hide();
            action.onPress();
          }}
        >
          <Text variant="bodyStrong" color="textOnPrimary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      left: t.spacing.lg,
      right: t.spacing.lg,
      zIndex: t.zIndex.toast,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      ...t.elevation[3],
    },
    message: { flex: 1 },
    success: { backgroundColor: t.colors.primary },
    error: { backgroundColor: t.colors.danger },
    info: { backgroundColor: t.colors.textPrimary },
  });
