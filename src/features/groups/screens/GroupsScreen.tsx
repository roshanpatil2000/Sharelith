import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Plus, Users } from 'lucide-react-native';
import {
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
} from '@/components';
import { VerifyEmailBanner } from '@/features/account/components/VerifyEmailBanner';
import { overallBalance } from '@/features/friends/balances';
import { FriendBalanceText } from '@/features/friends/components/FriendBalanceText';
import { useGroups, type GroupSummary } from '../api';
import { useGroupBalances } from '../balances';
import { memberCountLabel } from '../groupTypes';
import { GroupCover } from '../components/GroupCover';

function CreateGroupHeaderButton() {
  const navigation = useNavigation();
  return (
    <IconButton
      icon={Plus}
      accessibilityLabel="Create a group"
      color="primary"
      onPress={() => navigation.navigate('CreateGroup')}
      testID="groups-create"
    />
  );
}

// headerRight is called as a function: render the button as a component.
const renderCreateGroupButton = () => <CreateGroupHeaderButton />;

export function GroupsScreen() {
  const navigation = useNavigation();
  const {
    data: groups,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useGroups();
  const balances = useGroupBalances();

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: renderCreateGroupButton });
  }, [navigation]);

  const renderItem = ({ item }: { item: GroupSummary }) => (
    <ListRow
      testID={`group-${item.id}`}
      title={item.name}
      subtitle={memberCountLabel(item.member_count)}
      leading={<GroupCover type={item.type} uri={item.cover_url} />}
      trailing={<FriendBalanceText balance={balances[item.id] ?? []} />}
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
    />
  );

  return (
    <Screen>
      <Box p="lg">
        <BalanceSummary balances={overallBalance(balances)} />
      </Box>
      <Divider />
      <VerifyEmailBanner />
      {isError ? (
        <ErrorView onRetry={refetch} />
      ) : (
        <PullToRefreshList
          data={groups ?? []}
          keyExtractor={g => g.id}
          renderItem={renderItem}
          loading={isLoading}
          refreshing={isRefetching}
          onRefresh={refetch}
          empty={
            <EmptyState
              icon={Users}
              title="No groups yet"
              message="Create a group for your trip, home or anything you share costs on."
              actionLabel="Start a new group"
              onAction={() => navigation.navigate('CreateGroup')}
            />
          }
        />
      )}
      <FAB onPress={() => navigation.navigate('AddExpense')} testID="fab" />
    </Screen>
  );
}
