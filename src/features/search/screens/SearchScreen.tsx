import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import {
  AmountText,
  Avatar,
  Box,
  CategoryIcon,
  EmptyState,
  ListRow,
  Screen,
  SearchBar,
  SectionHeader,
  Text,
} from '@/components';
import { asCategoryKey } from '@/domain/categorize';
import { friendlyDate } from '@/domain/dates';
import { useFriends } from '@/features/friends/api';
import { useGroups } from '@/features/groups/api';
import { GroupCover } from '@/features/groups/components/GroupCover';
import {
  MIN_SEARCH,
  nameMatches,
  useDebounced,
  useExpenseSearch,
} from '../api';

/** Search friends, groups and expenses (description, notes, comments). */
export function SearchScreen() {
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const settled = useDebounced(query);
  const active = query.trim().length >= MIN_SEARCH;

  const { data: friends } = useFriends();
  const { data: groups } = useGroups();
  const expenses = useExpenseSearch(settled);
  const groupName = useMemo(
    () => new Map((groups ?? []).map(g => [g.id, g.name])),
    [groups],
  );

  const matchingFriends = active
    ? (friends ?? []).filter(
        f =>
          nameMatches(f.full_name, query) || nameMatches(f.email ?? '', query),
      )
    : [];
  const matchingGroups = active
    ? (groups ?? []).filter(g => nameMatches(g.name, query))
    : [];
  const found = expenses.data ?? [];
  const searching =
    active && (expenses.isFetching || settled.trim() !== query.trim());
  const nothing =
    active &&
    !searching &&
    !matchingFriends.length &&
    !matchingGroups.length &&
    !found.length;

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Box p="md">
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Friends, groups, expenses, notes"
          autoFocus
          testID="search-input"
        />
      </Box>
      <ScrollView keyboardShouldPersistTaps="handled">
        {!active ? (
          <EmptyState
            icon={Search}
            title="Search Sharelith"
            message="Find a friend, a group, or an expense by its description, notes or comments."
          />
        ) : null}

        {matchingFriends.length ? <SectionHeader title="Friends" /> : null}
        {matchingFriends.map(f => (
          <ListRow
            key={f.id}
            title={f.full_name}
            subtitle={f.email ?? undefined}
            leading={<Avatar name={f.full_name} uri={f.avatar_url} />}
            onPress={() =>
              navigation.navigate('FriendDetail', { friendId: f.id })
            }
            testID={`search-friend-${f.id}`}
          />
        ))}

        {matchingGroups.length ? <SectionHeader title="Groups" /> : null}
        {matchingGroups.map(g => (
          <ListRow
            key={g.id}
            title={g.name}
            leading={<GroupCover type={g.type} uri={g.cover_url} />}
            onPress={() =>
              navigation.navigate('GroupDetail', { groupId: g.id })
            }
            testID={`search-group-${g.id}`}
          />
        ))}

        {found.length ? <SectionHeader title="Expenses" /> : null}
        {found.map(e => (
          <ListRow
            key={e.id}
            title={e.is_payment ? 'Payment' : e.description}
            subtitle={[
              friendlyDate(e.expense_date),
              e.group_id ? groupName.get(e.group_id) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            leading={<CategoryIcon category={asCategoryKey(e.category)} />}
            trailing={
              e.my_net_minor !== 0 ? (
                <AmountText
                  minor={e.my_net_minor}
                  currency={e.currency}
                  colored
                />
              ) : (
                <AmountText minor={e.amount_minor} currency={e.currency} />
              )
            }
            onPress={() =>
              navigation.navigate('ExpenseDetail', { expenseId: e.id })
            }
            testID={`search-expense-${e.id}`}
          />
        ))}

        {searching ? <ActivityIndicator style={styles.spinner} /> : null}
        {nothing ? (
          <EmptyState
            icon={Search}
            title="No results"
            message={`Nothing matches “${query.trim()}”.`}
          />
        ) : null}
        {active && expenses.isError ? (
          <Box p="lg">
            <Text color="textSecondary">
              Couldn’t search expenses. Try again.
            </Text>
          </Box>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ spinner: { margin: 16 } });
