import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
  type Edge,
} from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { useTabBarSpace } from './TabBarSpace';

/**
 * Android with edge-to-edge: the window no longer shrinks for the keyboard
 * (adjustResize is ignored) and KeyboardAvoidingView mis-measures it, so pad
 * the screen by the keyboard's height ourselves. iOS uses
 * KeyboardAvoidingView. Returns the padding to add below the content.
 */
function useAndroidKeyboardPadding(bottomPadded: boolean): number {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    // Measured from where the keyboard starts on screen: its reported
    // height leaves out part of it when drawing edge to edge.
    const show = Keyboard.addListener('keyboardDidShow', e =>
      setHeight(Dimensions.get('screen').height - e.endCoordinates.screenY),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  // The safe area already pads the bottom inset when 'bottom' is an edge.
  return height > 0
    ? Math.max(0, height - (bottomPadded ? insets.bottom : 0))
    : 0;
}

type Props = {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Leave off for screens that render a list. */
  scroll?: boolean;
  /** Apply standard horizontal padding. */
  padded?: boolean;
  /** Safe-area edges; tab screens usually skip 'bottom'. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered above the content and outside the scroll, e.g. a FAB. */
  overlay?: React.ReactNode;
  /**
   * With `scroll`: enables pull-to-refresh. The spinner shows only while a
   * pull's promise is pending, never for background reloads.
   */
  onRefresh?: () => unknown;
  /** Pinned below the content, e.g. a banner ad; overlays sit above it. */
  footer?: React.ReactNode;
  testID?: string;
};

export function Screen({
  children,
  scroll = false,
  padded = false,
  edges = ['left', 'right'],
  contentStyle,
  overlay,
  onRefresh,
  footer,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const tabBarSpace = useTabBarSpace();
  const [pulling, setPulling] = useState(false);
  const keyboardPadding = useAndroidKeyboardPadding(edges.includes('bottom'));
  const pull = async () => {
    setPulling(true);
    try {
      await onRefresh?.();
    } finally {
      setPulling(false);
    }
  };
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={pulling}
            onRefresh={pull}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
      {tabBarSpace ? <View style={{ height: tabBarSpace }} /> : null}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.root} edges={edges} testID={testID}>
      <KeyboardAvoidingView
        style={[styles.flex, { paddingBottom: keyboardPadding }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex}>
          {inner}
          {overlay}
        </View>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    padded: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.lg },
  });
