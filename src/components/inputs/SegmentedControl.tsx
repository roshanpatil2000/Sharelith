import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

export type Segment<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  testID?: string;
};

/** Used for split-type tabs (= / 1.23 / % / shares / +/-) and filters. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  testID,
}: Props<T>) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.track} accessibilityRole="tablist" testID={testID}>
      {segments.map(seg => {
        const selected = seg.value === value;
        return (
          <Pressable
            key={seg.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={seg.label}
            onPress={() => onChange(seg.value)}
            style={[styles.segment, selected && styles.selected]}
            pressedStyle={styles.pressed}
          >
            <Text
              variant="label"
              color={selected ? 'primaryText' : 'textSecondary'}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: t.colors.primarySoft,
      borderRadius: t.radius.md,
      padding: t.spacing.xxs,
    },
    segment: {
      flex: 1,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.sm,
    },
    selected: { backgroundColor: t.colors.surfaceRaised, ...t.elevation[1] },
    pressed: { opacity: 0.7 },
  });
