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
import { useAdsEnabled } from '@/features/ads/ads';
import { NativeAdRow, withAdSlots } from '@/features/ads/NativeAdRow';
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
  const adsEnabled = useAdsEnabled();
  const entries = withAdSlots(items, adsEnabled);

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
        data={entries}
        loading={isLoading}
        onRefresh={refetch}
        keyExtractor={entry =>
          entry.type === 'ad' ? entry.key : String(entry.item.id)
        }
        renderItem={({ item: entry }) => {
          if (entry.type === 'ad') {
            return <NativeAdRow />;
          }
          const item = entry.item;
          return (
            <ActivityRow
              item={item}
              me={me}
              onPress={
                item.group_id
                  ? () =>
                      navigation.navigate('GroupDetail', {
                        groupId: item.group_id!,
                      })
                  : item.kind === 'reminder'
                  ? () =>
                      navigation.navigate('FriendDetail', {
                        friendId:
                          item.actor_id === me
                            ? item.subject_id!
                            : item.actor_id!,
                      })
                  : undefined
              }
            />
          );
        }}
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
