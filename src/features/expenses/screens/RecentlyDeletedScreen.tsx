import React, { useState } from 'react';
import { Trash2 } from 'lucide-react-native';
import {
  AmountText,
  Button,
  CategoryIcon,
  EmptyState,
  ErrorView,
  ListRow,
  ListRowSkeleton,
  PullToRefreshList,
  Screen,
  Stack,
  toast,
} from '@/components';
import { asCategoryKey } from '@/domain/categorize';
import { friendlyDate, toISODate } from '@/domain/dates';
import { toAppError } from '@/features/auth/errors';
import { useSetExpenseDeleted } from '../api';
import { useDeletedExpenses, type DeletedExpense } from '../deleted';

/** Expenses and payments you deleted, each with a way to bring it back. */
export function RecentlyDeletedScreen() {
  const { data, isLoading, isError, refetch } = useDeletedExpenses();
  const restore = useSetExpenseDeleted();
  const [restoring, setRestoring] = useState<string | null>(null);

  const onRestore = (e: DeletedExpense) => {
    setRestoring(e.id);
    restore.mutate(
      { id: e.id, deleted: false },
      {
        onSuccess: () =>
          toast.show(
            e.is_payment ? 'Payment restored' : `Restored “${e.description}”`,
            'success',
          ),
        onError: err => toast.show(toAppError(err).message, 'error'),
        onSettled: () => setRestoring(null),
      },
    );
  };

  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }
  if (isLoading) {
    return (
      <Screen>
        <ListRowSkeleton />
        <ListRowSkeleton />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <PullToRefreshList
        data={data ?? []}
        keyExtractor={e => e.id}
        onRefresh={refetch}
        renderItem={({ item: e }) => (
          <ListRow
            title={e.is_payment ? 'Payment' : e.description}
            subtitle={[
              `Deleted ${friendlyDate(
                toISODate(new Date(e.deleted_at)),
              ).toLowerCase()}`,
              e.group_name,
            ]
              .filter(Boolean)
              .join(' · ')}
            leading={<CategoryIcon category={asCategoryKey(e.category)} />}
            trailing={
              <Stack align="flex-end" gap="xs">
                <AmountText minor={e.amount_minor} currency={e.currency} />
                <Button
                  title="Restore"
                  size="sm"
                  variant="secondary"
                  loading={restoring === e.id}
                  disabled={!!restoring}
                  onPress={() => onRestore(e)}
                  testID={`restore-${e.id}`}
                />
              </Stack>
            }
            testID={`deleted-${e.id}`}
          />
        )}
        empty={
          <EmptyState
            icon={Trash2}
            title="Nothing deleted"
            message="Expenses and payments you delete show here, so you can bring them back."
          />
        }
      />
    </Screen>
  );
}
