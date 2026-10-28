import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Text } from '../primitives/Text';
import { Button } from '../inputs/Button';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Themed confirmation for destructive actions (delete expense, leave group). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="title">{title}</Text>
          {message ? <Text color="textSecondary">{message}</Text> : null}
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: t.spacing.xxl,
    },
    dialog: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: t.colors.surfaceRaised,
      borderRadius: t.radius.lg,
      padding: t.spacing.xl,
      gap: t.spacing.md,
      ...t.elevation[3],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: t.spacing.sm,
      marginTop: t.spacing.sm,
    },
  });
