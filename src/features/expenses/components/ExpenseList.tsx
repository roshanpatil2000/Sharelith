import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Receipt } from 'lucide-react-native';
import {
  AmountText,
  EmptyState,
  ErrorView,
  ListRow,
  Stack,
  Text,
} from '@/components';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import { useExpenses, type ExpenseFilter, type ExpenseSummary } from '../api';

const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

export function paidByLabel(
  expense: ExpenseSummary,
  userId: string | null,
  names: Record<string, string>,
): string {
  const amount = formatMoney(expense.amount_minor, expense.currency);
  if (expense.payer_count > 1) {
    return `${expense.payer_count} people paid ${amount}`;
  }
  const who =
    expense.paid_by === userId
      ? 'You'
      : names[expense.paid_by]?.split(' ')[0] ?? 'Someone';
  return `${who} paid ${amount}`;
}

function ExpenseRow({
  expense,
  names,
}: {
  expense: ExpenseSummary;
  names: Record<string, string>;
}) {
  const userId = useUserId();
  const net = expense.my_net_minor;
  return (
    <ListRow
      testID={`expense-${expense.id}`}
      title={expense.description}
      subtitle={`${dateLabel(expense.expense_date)} · ${paidByLabel(
        expense,
        userId,
        names,
      )}`}
      trailing={
        <Stack align="flex-end" gap="xxs">
          <Text variant="caption" color="textSecondary">
            {net > 0 ? 'you lent' : net < 0 ? 'you borrowed' : 'not involved'}
          </Text>
          {net !== 0 ? (
            <AmountText minor={net} currency={expense.currency} />
          ) : null}
        </Stack>
      }
    />
  );
}

type Props = ExpenseFilter & {
  /** Display names by user id, for "Asha paid". */
  names: Record<string, string>;
  emptyMessage: string;
};

/** Newest first, for a group or for what you share with a friend. */
export function ExpenseList({ names, emptyMessage, ...filter }: Props) {
  const { data, isLoading, isError, refetch } = useExpenses(filter);
  if (isError) {
    return <ErrorView onRetry={refetch} />;
  }
  if (isLoading) {
    return <ActivityIndicator />;
  }
  if (!data?.length) {
    return (
      <EmptyState
        icon={Receipt}
        title="No expenses yet"
        message={emptyMessage}
      />
    );
  }
  return (
    <>
      {data.map(expense => (
        <ExpenseRow key={expense.id} expense={expense} names={names} />
      ))}
    </>
  );
}
