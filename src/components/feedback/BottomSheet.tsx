import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useStyles, type Theme } from '@/app/theme';

type Props = Omit<BottomSheetModalProps, 'children'> & {
  children: React.ReactNode;
  ref?: React.Ref<BottomSheetModal>;
  /**
   * Fixed-height sheet whose content scrolls (long option lists).
   * Default is content-sized.
   */
  scrollable?: boolean;
  /** Pinned above the scrolling content, e.g. a search field. */
  header?: React.ReactNode;
};

/**
 * Themed modal bottom sheet (pickers, quick actions). Present with
 * `ref.current?.present()`.
 * Requires `BottomSheetModalProvider` at the root (see AppProviders).
 */
export function BottomSheet({
  children,
  ref,
  scrollable = false,
  header,
  ...rest
}: Props) {
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
      enableDynamicSizing={!scrollable}
      snapPoints={scrollable ? ['75%'] : undefined}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      {...rest}
    >
      {scrollable ? (
        // The header is the scroll view's first child, pinned with
        // stickyHeaderIndices: a sibling view above it gets hidden.
        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={header ? [0] : undefined}
        >
          {header ? <View style={styles.header}>{header}</View> : null}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={styles.content}>
          {header}
          {children}
        </BottomSheetView>
      )}
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
    header: {
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.sm,
      gap: t.spacing.md,
      // Solid so rows don't show through while it's pinned.
      backgroundColor: t.colors.surfaceRaised,
    },
    scrollContent: { paddingBottom: t.spacing.huge },
  });
