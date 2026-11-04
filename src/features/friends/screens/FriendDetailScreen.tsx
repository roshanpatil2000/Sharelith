import React, { useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HandCoins, UserMinus } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  Avatar,
  Badge,
  BalanceSummary,
  Button,
  ConfirmDialog,
  Divider,
  EmptyState,
  FAB,
  Icon,
  ListRow,
  Screen,
  Stack,
  Text,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { toAppError } from '@/features/auth/errors';
import { useRefreshExpenses } from '@/features/expenses/api';
import { ExpenseList } from '@/features/expenses/components/ExpenseList';
import { useFriend, useRemoveFriend } from '../api';
import { useFriendBalances } from '../balances';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendDetail'>;

export function FriendDetailScreen({ route }: Props) {
  const { friendId } = route.params;
  const styles = useStyles(createStyles);
  const navigation = useNavigation();
  const { data: current, isLoading } = useFriend(friendId);
  // Removing drops the friend from the cache straight away; keep showing them
  // until the request finishes and the screen closes.
  const lastFriend = useRef(current);
  if (current) {
    lastFriend.current = current;
  }
  const friend = current ?? lastFriend.current;
  const balances = useFriendBalances();
  const removeFriend = useRemoveFriend();
  const refreshExpenses = useRefreshExpenses();
  const [confirm, setConfirm] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: friend?.full_name ?? '' });
  }, [navigation, friend?.full_name]);

  if (!friend) {
    if (isLoading) {
      return <Screen>{null}</Screen>;
    }
    // Group members needn't be friends: either of you may have removed the other.
    return (
      <Screen>
        <EmptyState
          icon={UserMinus}
          title="Not on your friends list"
          message="You can add them as a friend with their email."
        />
      </Screen>
    );
  }

  const first = friend.full_name.split(' ')[0];

  const remove = () =>
    removeFriend.mutate(friend.id, {
      onSuccess: () => {
        toast.show(`Removed ${first}`);
        navigation.goBack();
      },
      onError: e => {
        setConfirm(false);
        toast.show(toAppError(e).message, 'error');
      },
    });

  return (
    <Screen
      scroll
      edges={['bottom', 'left', 'right']}
      onRefresh={refreshExpenses}
      overlay={
        <FAB
          testID="friend-add-expense"
          onPress={() =>
            navigation.navigate('AddExpense', { friendId: friend.id })
          }
        />
      }
    >
      <View style={styles.header}>
        <Avatar name={friend.full_name} uri={friend.avatar_url} size="xl" />
        <Stack align="center" gap="xs">
          <Text variant="title" align="center">
            {friend.full_name}
          </Text>
          {friend.email ? (
            <Text color="textSecondary">{friend.email}</Text>
          ) : null}
          {friend.invited ? <Badge label="Invited" tone="neutral" /> : null}
        </Stack>
        <BalanceSummary
          balances={balances[friend.id] ?? []}
          subject={`With ${first}`}
        />
        {(balances[friend.id] ?? []).length > 0 ? (
          <Button
            title="Settle up"
            icon={HandCoins}
            onPress={() =>
              navigation.navigate('SettleUp', { friendId: friend.id })
            }
            testID="friend-settle-up"
          />
        ) : null}
      </View>
      <Divider />
      <ExpenseList
        friendId={friend.id}
        names={{ [friend.id]: friend.full_name }}
        emptyMessage={`Expenses you share with ${first} will show here.`}
      />
      <Divider />
      <ListRow
        title="Remove friend"
        leading={<Icon icon={UserMinus} color="danger" />}
        onPress={() => setConfirm(true)}
        testID="friend-remove"
      />
      <ConfirmDialog
        visible={confirm}
        title={`Remove ${first}?`}
        message="You can add them again any time."
        confirmLabel="Remove"
        destructive
        loading={removeFriend.isPending}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.xl,
      backgroundColor: t.colors.surface,
    },
  });
