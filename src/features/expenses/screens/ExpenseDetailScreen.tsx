import React, { useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pencil, Receipt, Trash2 } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import {
  AmountText,
  Avatar,
  Banner,
  Button,
  ConfirmDialog,
  Divider,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Stack,
  Text,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { formatMoney } from '@/domain/money';
import { longDate } from '@/domain/dates';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useExpense, useSetExpenseDeleted } from '../api';
import { myNet, shareNote, splitTitle } from '../detail';
import { ReceiptSection } from '@/features/pro/components/ReceiptSection';
import { CommentsSection } from '../components/CommentsSection';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export function ExpenseDetailScreen({ route, navigation }: Props) {
  const { expenseId } = route.params;
  const styles = useStyles(createStyles);
  const me = useUserId();
  const { data: expense, isLoading } = useExpense(expenseId);
  const setDeleted = useSetExpenseDeleted();
  const [confirm, setConfirm] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: expense?.is_payment ? 'Payment' : 'Expense',
    });
  }, [navigation, expense?.is_payment]);

  if (isLoading) {
    return <Screen>{null}</Screen>;
  }
  if (!expense) {
    return (
      <Screen padded>
        <Banner tone="danger" message="This expense was deleted." />
      </Screen>
    );
  }

  const name = (id: string, profile?: { full_name: string } | null) =>
    id === me ? 'You' : profile?.full_name ?? 'Someone';
  const mine = expense.created_by === me;
  const net = myNet(expense, me);
  const { currency } = expense;

  const remove = () =>
    setDeleted.mutate(
      { id: expense.id, deleted: true },
      {
        onSuccess: () => {
          setConfirm(false);
          toast.show(
            expense.is_payment
              ? 'Deleted payment'
              : `Deleted “${expense.description}”`,
          );
          navigation.goBack();
        },
        onError: e => {
          setConfirm(false);
          toast.show(toAppError(e).message, 'error');
        },
      },
    );

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Icon icon={Receipt} size={28} color="primary" />
        </View>
        <Text variant="title" align="center" testID="detail-description">
          {expense.description}
        </Text>
        <Text variant="display" testID="detail-amount">
          {formatMoney(expense.amount_minor, currency)}
        </Text>
        <Text color="textSecondary" align="center">
          {[expense.group?.name, longDate(expense.expense_date)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text variant="caption" color="textSecondary" testID="detail-added-by">
          Added by {name(expense.created_by, expense.creator)}
        </Text>
        <View testID="detail-effect">
          {net === 0 ? (
            <Text color="textSecondary">You’re not involved</Text>
          ) : (
            <Text variant="bodyStrong">
              {net > 0 ? 'You lent ' : 'You borrowed '}
              <AmountText minor={net} currency={currency} />
            </Text>
          )}
        </View>
      </View>

      <SectionHeader title="Paid by" />
      {expense.expense_payers.map(p => (
        <ListRow
          key={p.user_id}
          testID={`detail-payer-${p.user_id}`}
          leading={<Avatar name={name(p.user_id, p.profile)} />}
          title={name(p.user_id, p.profile)}
          trailing={
            <Text variant="bodyStrong">
              {formatMoney(p.paid_minor, currency)}
            </Text>
          }
        />
      ))}

      <SectionHeader title={splitTitle(expense)} />
      {expense.expense_shares.map(s => (
        <ListRow
          key={s.user_id}
          testID={`detail-share-${s.user_id}`}
          leading={<Avatar name={name(s.user_id, s.profile)} />}
          title={name(s.user_id, s.profile)}
          subtitle={shareNote(s, currency) ?? undefined}
          trailing={
            <Stack align="flex-end" gap="xxs">
              <Text variant="caption" color="textSecondary">
                owes
              </Text>
              <Text variant="bodyStrong">
                {formatMoney(s.owed_minor, currency)}
              </Text>
            </Stack>
          }
        />
      ))}

      {expense.notes ? (
        <>
          <SectionHeader title="Notes" />
          <Text style={styles.notes} testID="detail-notes">
            {expense.notes}
          </Text>
        </>
      ) : null}

      {expense.is_payment ? null : (
        <ReceiptSection expenseId={expense.id} path={expense.receipt_path} />
      )}

      <CommentsSection expenseId={expense.id} />

      <Divider />
      <Stack gap="sm" style={styles.actions}>
        {expense.is_payment ? null : (
          <Button
            title={mine ? 'Edit expense' : 'Rename'}
            icon={Pencil}
            variant="secondary"
            fullWidth
            onPress={() =>
              navigation.navigate('AddExpense', { expenseId: expense.id })
            }
            testID="detail-edit"
          />
        )}
        {mine ? (
          <Button
            title={expense.is_payment ? 'Delete payment' : 'Delete expense'}
            icon={Trash2}
            variant="danger"
            fullWidth
            onPress={() => setConfirm(true)}
            testID="detail-delete"
          />
        ) : (
          <Text variant="caption" color="textSecondary" align="center">
            Only {name(expense.created_by, expense.creator)} can change the
            amount or delete this.
          </Text>
        )}
      </Stack>

      <ConfirmDialog
        visible={confirm}
        title={
          expense.is_payment
            ? 'Delete this payment?'
            : `Delete “${expense.description}”?`
        }
        message="Balances update for everyone on it."
        confirmLabel="Delete"
        destructive
        loading={setDeleted.isPending}
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    notes: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.md },
    header: {
      alignItems: 'center',
      gap: t.spacing.sm,
      padding: t.spacing.xl,
      backgroundColor: t.colors.surface,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primarySoft,
    },
    actions: { padding: t.spacing.lg },
  });
