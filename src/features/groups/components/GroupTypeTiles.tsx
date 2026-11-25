import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '@/app/theme';
import { Icon, Pressable, Text } from '@/components';
import {
  GROUP_TYPES,
  groupTypeIcon,
  groupTypeLabel,
  type GroupType,
} from '../groupTypes';

function Tile({
  type,
  selected,
  onPress,
}: {
  type: GroupType;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  const { motion } = useTheme();
  const lift = useSharedValue(selected ? 1.05 : 1);
  useEffect(() => {
    lift.value = withSpring(selected ? 1.05 : 1, motion.spring);
  }, [selected, lift, motion.spring]);
  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: lift.value }],
  }));
  return (
    <Animated.View style={[styles.slot, scale]}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={groupTypeLabel(type)}
        accessibilityState={{ selected }}
        style={[styles.tile, selected && styles.selected]}
        testID={`group-type-${type}`}
      >
        <Icon
          icon={groupTypeIcon(type)}
          color={selected ? 'primaryText' : 'textSecondary'}
        />
        <Text
          variant="label"
          numberOfLines={1}
          color={selected ? 'primaryText' : 'textPrimary'}
        >
          {groupTypeLabel(type)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** The four group types as square tiles in a row. */
export function GroupTypeTiles({
  value,
  onChange,
}: {
  value: GroupType;
  onChange: (type: GroupType) => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.row}>
      {GROUP_TYPES.map(type => (
        <Tile
          key={type}
          type={type}
          selected={type === value}
          onPress={() => onChange(type)}
        />
      ))}
    </View>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: t.spacing.sm },
    slot: { flex: 1 },
    tile: {
      minHeight: 80,
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    selected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primarySoft,
    },
  });
