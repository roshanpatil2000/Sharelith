import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Inbox } from 'lucide-react-native';
import {
  EmptyState,
  ErrorView,
  FAB,
  PullToRefreshList,
  Screen,
} from '@/components';
import { useUserId } from '@/features/auth/authStore';
import { useActivity } from '../api';
import { ActivityRow } from '../components/ActivityRow';

export function ActivityScreen() {
  const navigation = useNavigation();
  const me = useUserId();
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivity();
  const items = data?.pages.flat() ?? [];

  if (isError && items.length === 0) {
    return (
      <Screen>
        <ErrorView onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen overlay={<FAB onPress={() => navigation.navigate('AddExpense')} />}>
      <PullToRefreshList
        data={items}
        loading={isLoading}
        onRefresh={refetch}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <ActivityRow
            item={item}
            me={me}
            onPress={
              item.group_id
                ? () =>
                    navigation.navigate('GroupDetail', {
                      groupId: item.group_id!,
                    })
                : undefined
            }
          />
        )}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        empty={
          <EmptyState
            icon={Inbox}
            title="No activity yet"
            message="Expenses, payments and group changes will show up here."
          />
        }
        testID="activity-list"
      />
    </Screen>
  );
}
