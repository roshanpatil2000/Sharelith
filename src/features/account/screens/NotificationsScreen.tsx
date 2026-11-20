import React from 'react';
import { Platform } from 'react-native';
import { BellRing, HandCoins, Receipt, Users } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Box,
  Divider,
  ErrorView,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  Stack,
  Switch,
  Text,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { useProfile, useUpdateProfile, type ProfileUpdate } from '../api';

type NotifyKey =
  | 'notify_expenses'
  | 'notify_payments'
  | 'notify_groups'
  | 'notify_reminders';

const kinds: {
  key: NotifyKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}[] = [
  {
    key: 'notify_expenses',
    title: 'Expenses',
    subtitle: 'Someone adds, edits or deletes an expense with you',
    icon: Receipt,
  },
  {
    key: 'notify_payments',
    title: 'Payments',
    subtitle: 'Someone records a payment to or from you',
    icon: HandCoins,
  },
  {
    key: 'notify_groups',
    title: 'Groups',
    subtitle: 'You’re added to or removed from a group',
    icon: Users,
  },
  {
    key: 'notify_reminders',
    title: 'Payment reminders',
    subtitle: 'A friend reminds you what you owe them',
    icon: BellRing,
  },
];

/** Which kinds of push notification you get. The feed shows everything either way. */
export function NotificationsScreen() {
  const { data: profile, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();

  const save = (patch: ProfileUpdate) =>
    updateProfile.mutate(patch, {
      onError: e => toast.show(toAppError(e).message, 'error'),
    });

  if (isError && !profile) {
    return (
      <Screen>
        <ErrorView onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <SectionHeader title="Notify me when" />
      {kinds.map((k, i) => (
        <React.Fragment key={k.key}>
          {i > 0 ? <Divider inset={52} /> : null}
          {profile ? (
            <ListRow
              title={k.title}
              subtitle={k.subtitle}
              leading={<Icon icon={k.icon} color="textSecondary" />}
              trailing={
                <Switch
                  value={profile[k.key]}
                  onValueChange={on => save({ [k.key]: on })}
                  accessibilityLabel={k.title}
                  testID={`notify-${k.key}`}
                />
              }
              onPress={() => save({ [k.key]: !profile[k.key] })}
            />
          ) : (
            <Stack px="lg" py="md" gap="xs">
              <Skeleton width="40%" height={18} />
              <Skeleton width="80%" />
            </Stack>
          )}
        </React.Fragment>
      ))}
      <Box p="lg">
        <Text variant="caption" color="textSecondary">
          {Platform.OS === 'android'
            ? 'Everything still shows in Activity. To stop all notifications, turn them off for Sharelith in your phone’s settings.'
            : 'Everything still shows in Activity.'}
        </Text>
      </Box>
    </Screen>
  );
}
