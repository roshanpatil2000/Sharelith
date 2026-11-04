import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChevronDown, ChevronUp, HandCoins, Trash2 } from 'lucide-react-native';
import { useStyles, type Theme } from '@/app/theme';
import { Icon, Pressable, SwipeRow, Text } from '@/components';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import type { ExpenseSummary } from '../api';

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

export const shortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

/**
 * One line for a run of payments: "Asha paid you ₹500.00" when they all go
 * the same way in one currency, otherwise just how many.
 */
export function paymentsSummary(
  payments: ExpenseSummary[],
  userId: string | null,
  names: Record<string, string>,
): string {
  const [first] = payments;
  const sameWay = payments.every(
    p =>
      p.paid_by === first!.paid_by &&
      p.paid_to === first!.paid_to &&
      p.currency === first!.currency,
  );
  const count = `${payments.length} payments`;
  if (!sameWay) {
    return count;
  }
  const total = payments.reduce((sum, p) => sum + p.amount_minor, 0);
  return `${count} · ${paymentLabel(first!, userId, names)} ${formatMoney(
    total,
    first!.currency,
  )}`;
}

type RowProps = {
  payment: ExpenseSummary;
  names: Record<string, string>;
  /** Absent when someone else recorded it. */
  onDelete?: () => void;
  indented?: boolean;
};

/** A payment as a single quiet line, so the expenses around it stand out. */
export function PaymentRow({ payment, names, onDelete, indented }: RowProps) {
  const styles = useStyles(createStyles);
  const userId = useUserId();
  const label = `${paymentLabel(payment, userId, names)} ${formatMoney(
    payment.amount_minor,
    payment.currency,
  )}`;
  return (
    <SwipeRow
      endAction={
        onDelete
          ? {
              label: 'Delete',
              icon: Trash2,
              tone: 'danger',
              onPress: onDelete,
              testID: `expense-delete-${payment.id}`,
            }
          : undefined
      }
    >
      <View
        style={[styles.row, indented && styles.indented]}
        testID={`expense-${payment.id}`}
        accessible
        accessibilityLabel={`Payment: ${label}, ${shortDate(
          payment.expense_date,
        )}`}
        accessibilityActions={
          onDelete ? [{ name: 'delete', label: 'Delete' }] : undefined
        }
        onAccessibilityAction={onDelete ? () => onDelete() : undefined}
      >
        <Icon icon={HandCoins} size={16} color="textSecondary" />
        <Text variant="caption" color="textSecondary" style={styles.label}>
          {label}
        </Text>
        <Text variant="caption" color="textSecondary">
          {shortDate(payment.expense_date)}
        </Text>
      </View>
    </SwipeRow>
  );
}

type GroupProps = {
  payments: ExpenseSummary[];
  names: Record<string, string>;
  canDelete: (payment: ExpenseSummary) => boolean;
  onDelete: (payment: ExpenseSummary) => void;
};

/** Several payments in a row, folded into one line until tapped. */
export function PaymentGroup({
  payments,
  names,
  canDelete,
  onDelete,
}: GroupProps) {
  const styles = useStyles(createStyles);
  const userId = useUserId();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={styles.row}
        pressedStyle={styles.pressed}
        onPress={() => setOpen(o => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID={`payments-${payments[0]!.id}`}
      >
        <Icon icon={HandCoins} size={16} color="textSecondary" />
        <Text variant="caption" color="textSecondary" style={styles.label}>
          {paymentsSummary(payments, userId, names)}
        </Text>
        <Icon
          icon={open ? ChevronUp : ChevronDown}
          size={16}
          color="textSecondary"
        />
      </Pressable>
      {open
        ? payments.map(p => (
            <PaymentRow
              key={p.id}
              payment={p}
              names={names}
              indented
              onDelete={canDelete(p) ? () => onDelete(p) : undefined}
            />
          ))
        : null}
    </>
  );
}

const createStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      minHeight: t.hitTarget,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.xs,
      backgroundColor: t.colors.background,
    },
    indented: { paddingLeft: t.spacing.xl + t.spacing.lg },
    pressed: { backgroundColor: t.colors.primarySoft },
    label: { flex: 1 },
  });
