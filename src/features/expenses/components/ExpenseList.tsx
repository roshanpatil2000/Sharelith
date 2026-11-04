import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Pencil, Receipt, Trash2 } from 'lucide-react-native';
import {
  AmountText,
  ConfirmDialog,
  EmptyState,
  ErrorView,
  ListRow,
  Stack,
  SwipeRow,
  Text,
  toast,
} from '@/components';
import { toAppError } from '@/features/auth/errors';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import {
  useExpenses,
  useSetExpenseDeleted,
  type ExpenseFilter,
  type ExpenseSummary,
} from '../api';
import { PaymentGroup, PaymentRow } from './PaymentRows';

/** Month over day, Splitwise-style, so the list scans by date. */
function DateBlock({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00`);
  return (
    <Stack align="center" style={dateStyle}>
      <Text variant="caption" color="textSecondary">
        {d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
      </Text>
      <Text variant="bodyStrong">{d.getDate()}</Text>
    </Stack>
  );
}

const dateStyle = { width: 36 };

type ListItem =
  | { kind: 'expense'; expense: ExpenseSummary }
  | { kind: 'payments'; payments: ExpenseSummary[] };

/** Folds payments next to each other into one item. */
export function groupPayments(expenses: ExpenseSummary[]): ListItem[] {
  const items: ListItem[] = [];
  for (const expense of expenses) {
    const last = items[items.length - 1];
    if (!expense.is_payment) {
      items.push({ kind: 'expense', expense });
    } else if (last?.kind === 'payments') {
      last.payments.push(expense);
    } else {
      items.push({ kind: 'payments', payments: [expense] });
    }
  }
  return items;
}

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
  onEdit,
  onDelete,
}: {
  expense: ExpenseSummary;
  names: Record<string, string>;
  onEdit: () => void;
  /** Absent when someone else added it: only they can delete it. */
  onDelete?: () => void;
}) {
  const userId = useUserId();
  const net = expense.my_net_minor;
  const actions = onDelete
    ? [
        { name: 'edit', label: 'Edit' },
        { name: 'delete', label: 'Delete' },
      ]
    : [{ name: 'edit', label: 'Rename' }];
  return (
    <SwipeRow
      startAction={{
        label: 'Edit',
        icon: Pencil,
        tone: 'primary',
        onPress: onEdit,
        testID: `expense-edit-${expense.id}`,
      }}
      endAction={
        onDelete
          ? {
              label: 'Delete',
              icon: Trash2,
              tone: 'danger',
              onPress: onDelete,
              testID: `expense-delete-${expense.id}`,
            }
          : undefined
      }
    >
      <ListRow
        testID={`expense-${expense.id}`}
        onPress={onEdit}
        accessibilityActions={actions}
        onAccessibilityAction={action =>
          action === 'delete' ? onDelete?.() : onEdit()
        }
        leading={<DateBlock date={expense.expense_date} />}
        title={expense.description}
        subtitle={paidByLabel(expense, userId, names)}
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
    </SwipeRow>
  );
}

type Props = ExpenseFilter & {
  /** Display names by user id, for "Asha paid". */
  names: Record<string, string>;
  emptyMessage: string;
};

/** Newest first, for a group or for what you share with a friend. */
export function ExpenseList({ names, emptyMessage, ...filter }: Props) {
  const userId = useUserId();
  const { data, isLoading, isError, refetch } = useExpenses(filter);
  const navigation = useNavigation();
  const setDeleted = useSetExpenseDeleted();
  const [deleting, setDeleting] = useState<ExpenseSummary | null>(null);
  // Only whoever added an expense or recorded a payment can delete it.
  const canDelete = (expense: ExpenseSummary) => expense.created_by === userId;

  const confirmDelete = () => {
    const expense = deleting!;
    setDeleted.mutate(
      { id: expense.id, deleted: true },
      {
        onSuccess: () => {
          setDeleting(null);
          const what = expense.is_payment
            ? 'payment'
            : `“${expense.description}”`;
          toast.show(`Deleted ${what}`, 'info', {
            label: 'Undo',
            onPress: () =>
              setDeleted.mutate(
                { id: expense.id, deleted: false },
                {
                  onError: e => toast.show(toAppError(e).message, 'error'),
                },
              ),
          });
        },
        onError: e => {
          setDeleting(null);
          toast.show(toAppError(e).message, 'error');
        },
      },
    );
  };

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
      {groupPayments(data).map(item => {
        if (item.kind === 'payments') {
          const [only] = item.payments;
          return item.payments.length === 1 ? (
            <PaymentRow
              key={only!.id}
              payment={only!}
              names={names}
              onDelete={canDelete(only!) ? () => setDeleting(only!) : undefined}
            />
          ) : (
            <PaymentGroup
              key={only!.id}
              payments={item.payments}
              names={names}
              canDelete={canDelete}
              onDelete={setDeleting}
            />
          );
        }
        const { expense } = item;
        return (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            names={names}
            onEdit={() =>
              navigation.navigate('AddExpense', { expenseId: expense.id })
            }
            onDelete={
              canDelete(expense) ? () => setDeleting(expense) : undefined
            }
          />
        );
      })}
      <ConfirmDialog
        visible={!!deleting}
        title={
          deleting?.is_payment
            ? 'Delete this payment?'
            : `Delete “${deleting?.description ?? ''}”?`
        }
        message="Balances update for everyone on it. You can undo this straight after."
        confirmLabel="Delete"
        destructive
        loading={setDeleted.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
