import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  HandCoins,
  Receipt,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { AmountText, Icon, Pressable, Stack, Text } from '@/components';
import type { ActivityItem, ActivityKind } from '../api';
import { activityTime, describeActivity } from '../describe';

const ICONS: Record<ActivityKind, LucideIcon> = {
  expense_added: Receipt,
  expense_updated: Receipt,
  expense_deleted: Trash2,
  expense_restored: Receipt,
  payment_added: HandCoins,
  payment_deleted: Trash2,
  payment_restored: HandCoins,
  group_created: Users,
  member_added: UserPlus,
  member_left: UserMinus,
  member_removed: UserMinus,
};

type Props = {
  item: ActivityItem;
  me: string | null;
  onPress?: () => void;
};

export function ActivityRow({ item, me, onPress }: Props) {
  const styles = useStyles(createStyles);
  const { title, effect, amount } = describeActivity(item, me);
  const deleted = item.kind.endsWith('_deleted');
  const time = activityTime(item.created_at);
  return (
    <Pressable
      testID={`activity-${item.id}`}
      onPress={onPress}
      disabled={!onPress}
      style={styles.row}
      pressedStyle={styles.pressed}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, effect, time].filter(Boolean).join(', ')}
    >
      <View style={styles.icon}>
        <Icon
          icon={ICONS[item.kind]}
          size={20}
          color={deleted ? 'textSecondary' : 'primary'}
        />
      </View>
      <Stack style={styles.body} gap="xxs">
        <Text
          numberOfLines={3}
          color={deleted ? 'textSecondary' : 'textPrimary'}
        >
          {title}
        </Text>
        <Text variant="caption" color="textSecondary">
          {time}
        </Text>
      </Stack>
      {effect ? (
        <Stack align="flex-end" gap="xxs">
          <Text variant="caption" color="textSecondary">
            {effect}
          </Text>
          {amount !== null && item.currency ? (
            <AmountText
              minor={effect === 'you owe' ? -amount : amount}
              currency={item.currency}
            />
          ) : null}
        </Stack>
      ) : null}
    </Pressable>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
    },
    pressed: { backgroundColor: t.colors.primarySoft },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primarySoft,
    },
    body: { flex: 1 },
  });
