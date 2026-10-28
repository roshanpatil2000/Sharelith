import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useStyles, type Theme } from '@/app/theme';

type Props = Omit<BottomSheetModalProps, 'children'> & {
  children: React.ReactNode;
  ref?: React.Ref<BottomSheetModal>;
};

/**
 * Themed modal bottom sheet (pickers, quick actions). Content-sized by
 * default. Present with `ref.current?.present()`.
 * Requires `BottomSheetModalProvider` at the root (see AppProviders).
 */
export function BottomSheet({ children, ref, ...rest }: Props) {
  const styles = useStyles(createStyles);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    [],
  );
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      {...rest}
    >
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheetModal>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    background: { backgroundColor: t.colors.surfaceRaised },
    handle: { backgroundColor: t.colors.border, width: 40 },
    content: {
      padding: t.spacing.lg,
      paddingBottom: t.spacing.huge,
      gap: t.spacing.md,
    },
  });
