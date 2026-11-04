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
  /** Only they can change the amounts or delete it. */
  created_by: string;
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

export type PayerRow = { user_id: string; paid_minor: number };
export type ShareRow = {
  user_id: string;
  owed_minor: number;
  split_type: string;
  raw_value: number | null;
};

/** One expense with who paid and who owes, for editing. */
export type ExpenseDetail = {
  id: string;
  group_id: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  expense_date: string;
  created_by: string;
  expense_payers: PayerRow[];
  expense_shares: ShareRow[];
};

export const expenseKey = (userId: string | null, expenseId: string) =>
  ['expense', userId, expenseId] as const;

export function useExpense(expenseId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: expenseKey(userId, expenseId ?? ''),
    enabled: !!userId && !!expenseId,
    queryFn: async (): Promise<ExpenseDetail | null> => {
      const { data, error } = await supabase
        .from('expenses')
        .select(
          'id, group_id, description, amount_minor, currency, expense_date, created_by, expense_payers(user_id, paid_minor), expense_shares(user_id, owed_minor, split_type, raw_value)',
        )
        .eq('id', expenseId!)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) {
        throw toAppError(error);
      }
      return data as ExpenseDetail | null;
    },
  });
}

/** Rows for create_expense / update_expense from per-person amounts. */
export function equalSplitRows(
  paid: Record<string, number>,
  owed: Record<string, number>,
): { payers: PayerRow[]; shares: ShareRow[] } {
  return {
    payers: Object.entries(paid).map(([user_id, paid_minor]) => ({
      user_id,
      paid_minor,
    })),
    shares: Object.entries(owed).map(([user_id, owed_minor]) => ({
      user_id,
      owed_minor,
      split_type: 'equal',
      raw_value: null,
    })),
  };
}

/** Everything that shows expenses or balances is stale after a change. */
function useInvalidateExpenses() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: balancesKey(userId) }),
      qc.invalidateQueries({ queryKey: expensesKey(userId) }),
      qc.invalidateQueries({ queryKey: ['expense', userId] }),
    ]);
}

export type ExpenseUpdate = {
  id: string;
  description: string;
  amountMinor: number;
  currency: string;
  payers: PayerRow[];
  shares: ShareRow[];
};

export function useUpdateExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: async (update: ExpenseUpdate) => {
      const { error } = await supabase.rpc('update_expense', {
        eid: update.id,
        description: update.description,
        amount_minor: update.amountMinor,
        currency: update.currency,
        payers: update.payers,
        shares: update.shares,
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: invalidate,
  });
}

/** Anyone on an expense may rename it; amounts stay the creator's. */
export function useRenameExpense() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: async ({
      id,
      description,
    }: {
      id: string;
      description: string;
    }) => {
      const { error } = await supabase.rpc('rename_expense', {
        eid: id,
        description,
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: invalidate,
  });
}

/** Deletes, or restores with deleted: false (for Undo). Creator only. */
export function useSetExpenseDeleted() {
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: async ({ id, deleted }: { id: string; deleted: boolean }) => {
      const { error } = await supabase.rpc('set_expense_deleted', {
        eid: id,
        deleted,
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: invalidate,
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
  const invalidate = useInvalidateExpenses();
  return useMutation({
    mutationFn: async (expense: NewExpense): Promise<string> => {
      const { data, error } = await supabase.rpc('create_expense', {
        description: expense.description,
        amount_minor: expense.amountMinor,
        currency: expense.currency,
        group_id: expense.groupId,
        ...equalSplitRows(expense.paid, expense.owed),
      });
      if (error) {
        throw toAppError(error);
      }
      return data!;
    },
    onSuccess: invalidate,
  });
}
