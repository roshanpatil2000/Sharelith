import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Plus, Receipt, Users } from 'lucide-react-native';
import {
  BalanceSummary,
  Box,
  Divider,
  EmptyState,
  ErrorView,
  FAB,
  Icon,
  IconButton,
  ListRow,
  PullToRefreshList,
  Screen,
} from '@/components';
import { VerifyEmailBanner } from '@/features/account/components/VerifyEmailBanner';
import {
  useRefreshExpenses,
  useRefreshExpensesOnFocus,
} from '@/features/expenses/api';
import { overallBalance, useFriendBalances } from '@/features/friends/balances';
import { FriendBalanceText } from '@/features/friends/components/FriendBalanceText';
import { useGroups, type GroupSummary } from '../api';
import { useGroupBalances, useNonGroupBalance } from '../balances';
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
  const refreshExpenses = useRefreshExpenses();
  useRefreshExpensesOnFocus();
  const { data: groups, isLoading, isError, refetch } = useGroups();
  const balances = useGroupBalances();
  const nonGroup = useNonGroupBalance();
  // Everything you owe or are owed, so it matches the Friends tab.
  const overall = overallBalance(useFriendBalances());

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: renderCreateGroupButton });
  }, [navigation]);

  const renderItem = ({ item }: { item: GroupSummary }) => (
    <ListRow
      testID={`group-${item.id}`}
      title={item.name}
      subtitle={memberCountLabel(item.member_count)}
      leading={<GroupCover type={item.type} uri={item.cover_url} />}
      trailing={
        <FriendBalanceText
          balance={balances[item.id] ?? []}
          owedLabel="you are owed"
        />
      }
      onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
    />
  );

  return (
    <Screen>
      <Box p="lg">
        <BalanceSummary balances={overall} />
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
          onRefresh={refreshExpenses}
          ListFooterComponent={
            nonGroup.length > 0 ? (
              <ListRow
                testID="groups-non-group"
                title="Non-group expenses"
                subtitle="With friends, outside any group"
                leading={<Icon icon={Receipt} color="textSecondary" />}
                trailing={
                  <FriendBalanceText
                    balance={nonGroup}
                    owedLabel="you are owed"
                  />
                }
              />
            ) : null
          }
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
