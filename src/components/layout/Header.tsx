import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { IconButton } from '../inputs/IconButton';

type Props = {
  title?: string;
  onBack?: () => void;
  /** Right-side actions, typically IconButtons or a ghost Button. */
  actions?: React.ReactNode;
  /** Draws its own top safe-area inset (for screens without a native header). */
  safeTop?: boolean;
};

export function Header({ title, onBack, actions, safeTop = true }: Props) {
  const styles = useStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, safeTop && { paddingTop: insets.top }]}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton
            icon={ChevronLeft}
            accessibilityLabel="Back"
            onPress={onBack}
          />
        ) : null}
      </View>
      <Text
        variant="heading"
        numberOfLines={1}
        style={styles.title}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={[styles.side, styles.actions]}>{actions}</View>
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: t.spacing.xs,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    side: { minWidth: 88, flexDirection: 'row', alignItems: 'center' },
    actions: { justifyContent: 'flex-end' },
    title: { flex: 1, textAlign: 'center' },
  });
