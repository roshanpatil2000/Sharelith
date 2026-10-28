import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useStyles, type Theme } from '@/app/theme';

type Props = {
  children: React.ReactNode;
  /** Wrap content in a ScrollView. Leave off for screens that render a list. */
  scroll?: boolean;
  /** Apply standard horizontal padding. */
  padded?: boolean;
  /** Safe-area edges; tab screens usually skip 'bottom'. */
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Screen({
  children,
  scroll = false,
  padded = false,
  edges = ['left', 'right'],
  contentStyle,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, contentStyle]}
      keyboardShouldPersistTaps="handled"
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
