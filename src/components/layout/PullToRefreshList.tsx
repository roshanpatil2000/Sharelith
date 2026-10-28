import React from 'react';
import { RefreshControl } from 'react-native';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { useTheme } from '@/app/theme';
import { ListRowSkeleton } from '../display/Skeleton';
import { Divider } from '../primitives/Divider';

type Props<T> = FlashListProps<T> & {
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Rendered when not loading and data is empty. */
  empty?: React.ReactElement;
};

/** Default separator: inset to align with ListRow text after a 40pt avatar. */
function RowSeparator() {
  return <Divider inset={68} />;
}

/**
 * FlashList with pull-to-refresh, skeleton loading and empty states built in.
 * Every list screen (friends, groups, expenses, activity) uses this.
 */
export function PullToRefreshList<T>({
  loading = false,
  refreshing = false,
  onRefresh,
  empty,
  data,
  ...rest
}: Props<T>) {
  const { colors } = useTheme();

  if (loading && (!data || data.length === 0)) {
    return (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </>
    );
  }

  return (
    <FlashList
      data={data}
      ItemSeparatorComponent={RowSeparator}
      ListEmptyComponent={empty}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      {...rest}
    />
  );
}
