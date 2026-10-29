import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useStyles, useTheme, type Theme } from '@/app/theme';

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
  /** With `scroll`: enables pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
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
  refreshing = false,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const { colors } = useTheme();
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, contentStyle]}>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.root} edges={edges} testID={testID}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
        {overlay}
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
