import React, { useLayoutEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { UserPlus } from 'lucide-react-native';
import {
  Avatar,
  BalanceSummary,
  Box,
  Divider,
  EmptyState,
  ErrorView,
  FAB,
  IconButton,
  ListRow,
  PullToRefreshList,
  Screen,
  SegmentedControl,
} from '@/components';
import { VerifyEmailBanner } from '@/features/account/components/VerifyEmailBanner';
import { useFriends, type Friend } from '../api';
import {
  filterFriends,
  overallBalance,
  useFriendBalances,
  type FriendFilter,
} from '../balances';
import { FriendBalanceText } from '../components/FriendBalanceText';

function AddFriendHeaderButton() {
  const navigation = useNavigation();
  return (
    <IconButton
      icon={UserPlus}
      accessibilityLabel="Add friend"
      color="primary"
      onPress={() => navigation.navigate('AddFriend')}
      testID="friends-add"
    />
  );
}

// headerRight is called as a function, so it must render the button as a
// component rather than be the component (its hooks would run in the header).
const renderAddFriendButton = () => <AddFriendHeaderButton />;

const filters = [
  { value: 'all', label: 'All' },
  { value: 'owesYou', label: 'Owes you' },
  { value: 'youOwe', label: 'You owe' },
] as const;

export function FriendsScreen() {
  const navigation = useNavigation();
  const {
    data: friends,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useFriends();
  const balances = useFriendBalances();
  const [filter, setFilter] = useState<FriendFilter>('all');

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: renderAddFriendButton });
  }, [navigation]);

  const visible = useMemo(
    () => filterFriends(friends ?? [], balances, filter),
    [friends, balances, filter],
  );

  const renderItem = ({ item }: { item: Friend }) => (
    <ListRow
      testID={`friend-${item.id}`}
      title={item.full_name}
      subtitle={item.invited ? 'Invited · hasn’t joined yet' : undefined}
      leading={<Avatar name={item.full_name} uri={item.avatar_url} />}
      trailing={<FriendBalanceText balance={balances[item.id] ?? []} />}
      onPress={() => navigation.navigate('FriendDetail', { friendId: item.id })}
    />
  );

  return (
    <Screen>
      <Box p="lg" gap="md" bg="surface">
        <BalanceSummary balances={overallBalance(balances)} />
        {friends && friends.length > 0 ? (
          <SegmentedControl
            segments={filters}
            value={filter}
            onChange={setFilter}
            testID="friends-filter"
          />
        ) : null}
      </Box>
      <Divider />
      <VerifyEmailBanner />
      {isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <PullToRefreshList
          data={visible}
          keyExtractor={f => f.id}
          renderItem={renderItem}
          loading={isLoading}
          refreshing={isRefetching}
          onRefresh={refetch}
          empty={
            friends && friends.length > 0 ? (
              <EmptyState
                icon={UserPlus}
                title={
                  filter === 'owesYou'
                    ? 'Nobody owes you'
                    : 'You don’t owe anyone'
                }
              />
            ) : (
              <EmptyState
                icon={UserPlus}
                title="No friends yet"
                message="Add friends by email to split expenses outside of a group."
                actionLabel="Add friends"
                onAction={() => navigation.navigate('AddFriend')}
              />
            )
          }
        />
      )}
      <FAB onPress={() => navigation.navigate('AddExpense')} />
    </Screen>
  );
}
