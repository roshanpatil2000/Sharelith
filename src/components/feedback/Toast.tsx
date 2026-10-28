import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';

type ToastTone = 'success' | 'error' | 'info';
type ToastState = {
  message: string | null;
  tone: ToastTone;
  id: number;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>(set => ({
  message: null,
  tone: 'info',
  id: 0,
  show: (message, tone = 'info') => set(s => ({ message, tone, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

/** Call from anywhere: `toast.show('Expense saved', 'success')`. */
export const toast = {
  show: (message: string, tone?: ToastTone) =>
    useToastStore.getState().show(message, tone),
};

/** Mount once at the app root. */
export function ToastHost() {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { message, tone, id, hide } = useToastStore();

  useEffect(() => {
    if (!message) {
      return;
    }
    const timer = setTimeout(hide, 2800);
    return () => clearTimeout(timer);
  }, [message, id, hide]);

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
      <Text variant="bodyStrong" color="textOnPrimary">
        {message}
      </Text>
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
      ...t.elevation[3],
    },
    success: { backgroundColor: t.colors.primary },
    error: { backgroundColor: t.colors.danger },
    info: { backgroundColor: t.colors.textPrimary },
  });
