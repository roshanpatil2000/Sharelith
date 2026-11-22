import React from 'react';
import { StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { IconButton } from '../inputs/IconButton';
import { Button } from '../inputs/Button';

type Props = {
  title: string;
  onClose: () => void;
  action?: {
    title: string;
    /** When the visible title is too short to explain itself. */
    accessibilityLabel?: string;
    onPress: () => void;
    loading?: boolean;
    testID?: string;
  };
};

/** The top of a full-screen form: close, title, and the action that saves it. */
export function FormHeader({ title, onClose, action }: Props) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.bar}>
      <IconButton
        icon={X}
        accessibilityLabel="Close"
        onPress={onClose}
        testID="form-close"
      />
      <Text
        variant="title"
        numberOfLines={1}
        style={styles.title}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {action ? (
        <Button
          title={action.title}
          accessibilityLabel={action.accessibilityLabel}
          variant="link"
          loading={action.loading}
          onPress={action.onPress}
          testID={action.testID}
        />
      ) : null}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: 56,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    title: { flex: 1, fontWeight: '600' },
  });
