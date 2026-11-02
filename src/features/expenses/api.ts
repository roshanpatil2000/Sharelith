import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';

export type BalanceRow = {
  friend_id: string;
  group_id: string | null;
  currency: string;
  net_minor: number;
};

export type ExpenseSummary = {
  id: string;
  group_id: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  category: string;
  expense_date: string;
  is_payment: boolean;
  paid_by: string;
  payer_count: number;
  /** What this did to you: + you lent, − you borrowed. */
  my_net_minor: number;
};

export type ExpenseFilter = { groupId?: string; friendId?: string };

export const balancesKey = (userId: string | null) =>
  ['balances', userId] as const;
export const expensesKey = (userId: string | null) =>
  ['expenses', userId] as const;

/** Everything you owe or are owed, per person, group and currency. */
export function useBalances() {
  const userId = useUserId();
  return useQuery({
    queryKey: balancesKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<BalanceRow[]> => {
      const { data, error } = await supabase.rpc('list_my_balances');
      if (error) {
        throw toAppError(error);
      }
      return data ?? [];
    },
  });
}

export function useExpenses({ groupId, friendId }: ExpenseFilter) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...expensesKey(userId), groupId ?? null, friendId ?? null],
    enabled: !!userId,
    queryFn: async (): Promise<ExpenseSummary[]> => {
      const { data, error } = await supabase.rpc('list_expenses', {
        gid: groupId,
        friend: friendId,
      });
      if (error) {
        throw toAppError(error);
      }
      return data ?? [];
    },
  });
}

export type NewExpense = {
  description: string;
  amountMinor: number;
  currency: string;
  groupId?: string;
  /** Who paid what, in minor units. */
  paid: Record<string, number>;
  /** Who owes what, in minor units. */
  owed: Record<string, number>;
};

export function useCreateExpense() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: NewExpense): Promise<string> => {
      const { data, error } = await supabase.rpc('create_expense', {
        description: expense.description,
        amount_minor: expense.amountMinor,
        currency: expense.currency,
        group_id: expense.groupId,
        payers: Object.entries(expense.paid).map(([user_id, paid_minor]) => ({
          user_id,
          paid_minor,
        })),
        shares: Object.entries(expense.owed).map(([user_id, owed_minor]) => ({
          user_id,
          owed_minor,
          split_type: 'equal',
        })),
      });
      if (error) {
        throw toAppError(error);
      }
      return data!;
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: balancesKey(userId) }),
        qc.invalidateQueries({ queryKey: expensesKey(userId) }),
      ]),
  });
}
