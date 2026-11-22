import React from 'react';
import { StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Icon } from '../primitives/Icon';
import { Text } from '../primitives/Text';

type Props = {
  text: string;
  /** What it changes, for screen readers: "Paid by". */
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  testID?: string;
};

/** A choice that reads as part of a sentence: "Paid by [you]". */
export function PillTrigger({
  text,
  label,
  onPress,
  icon,
  disabled,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${label}, ${text}`}
      style={styles.pill}
    >
      {icon ? <Icon icon={icon} size={16} color="primaryText" /> : null}
      <Text
        variant="bodyStrong"
        color="primaryText"
        numberOfLines={1}
        style={styles.text}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      minHeight: 36,
      maxWidth: '100%',
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    text: { flexShrink: 1 },
  });
