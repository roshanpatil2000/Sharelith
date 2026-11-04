import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { HandCoins, Pencil, Receipt, Trash2 } from 'lucide-react-native';
import {
  AmountText,
  ConfirmDialog,
  Icon,
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

/** "You paid Asha", "Asha paid you", "Asha paid Ravi". */
export function paymentLabel(
  expense: ExpenseSummary,
  userId: string | null,
  names: Record<string, string>,
): string {
  const name = (id: string | null, you: string) =>
    id === userId ? you : names[id ?? '']?.split(' ')[0] ?? 'Someone';
  return `${name(expense.paid_by, 'You')} paid ${name(expense.paid_to, 'you')}`;
}

function PaymentRow({
  expense,
  names,
  onDelete,
}: {
  expense: ExpenseSummary;
  names: Record<string, string>;
  /** Absent when someone else recorded it. */
  onDelete?: () => void;
}) {
  const userId = useUserId();
  const net = expense.my_net_minor;
  return (
    <SwipeRow
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
        leading={<Icon icon={HandCoins} color="textSecondary" />}
        accessibilityActions={
          onDelete ? [{ name: 'delete', label: 'Delete' }] : undefined
        }
        onAccessibilityAction={onDelete ? () => onDelete() : undefined}
        title={paymentLabel(expense, userId, names)}
        subtitle={`${dateLabel(expense.expense_date)} · Payment`}
        trailing={
          <Stack align="flex-end" gap="xxs">
            <Text variant="caption" color="textSecondary">
              {net > 0 ? 'you paid' : net < 0 ? 'you received' : 'payment'}
            </Text>
            <Text variant="bodyStrong" color="textSecondary">
              {formatMoney(expense.amount_minor, expense.currency)}
            </Text>
          </Stack>
        }
      />
    </SwipeRow>
  );
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
      {data.map(expense =>
        expense.is_payment ? (
          <PaymentRow
            key={expense.id}
            expense={expense}
            names={names}
            onDelete={
              expense.created_by === userId
                ? () => setDeleting(expense)
                : undefined
            }
          />
        ) : (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            names={names}
            onEdit={() =>
              navigation.navigate('AddExpense', { expenseId: expense.id })
            }
            onDelete={
              expense.created_by === userId
                ? () => setDeleting(expense)
                : undefined
            }
          />
        ),
      )}
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
