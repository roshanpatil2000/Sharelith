import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { Icon } from '../primitives/Icon';

type Props = {
  title: string;
  subtitle?: string;
  /** Avatar, CategoryIcon or date block. */
  leading?: React.ReactNode;
  /** Usually a balance: small caption above an AmountText. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
};

/**
 * The workhorse row used for friends, groups, expenses, activity and settings.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  chevron = false,
  testID,
}: Props) {
  const styles = useStyles(createStyles);
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {chevron ? (
        <Icon icon={ChevronRight} size={18} color="textSecondary" />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={styles.row}
      pressedStyle={styles.pressed}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      minHeight: 64,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.surface,
    },
    pressed: { backgroundColor: t.colors.primarySoft },
    leading: { alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, gap: t.spacing.xxs },
    trailing: { alignItems: 'flex-end', gap: t.spacing.xxs },
  });
