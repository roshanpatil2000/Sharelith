import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { expensesKey } from '@/features/expenses/api';
import type { InsightRow } from '@/features/pro/insights';

export type GroupSpendingRow = {
  month: string;
  category: string;
  currency: string;
  total_minor: number;
  my_share_minor: number;
  my_paid_minor: number;
  expense_count: number;
};

export type MemberSpending = {
  user_id: string;
  currency: string;
  paid_minor: number;
  share_minor: number;
};

// Under the expenses key, so adding or editing an expense refreshes totals.
const totalsKey = (userId: string | null, groupId: string) =>
  [...expensesKey(userId), 'groupTotals', groupId] as const;

export function useGroupSpending(groupId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...totalsKey(userId, groupId), 'spending'],
    enabled: !!userId,
    queryFn: async (): Promise<GroupSpendingRow[]> => {
      const { data, error } = await supabase.rpc('group_spending', {
        gid: groupId,
      });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []).map(r => ({
        ...r,
        total_minor: Number(r.total_minor),
        my_share_minor: Number(r.my_share_minor),
        my_paid_minor: Number(r.my_paid_minor),
      }));
    },
  });
}

export function useMemberSpending(groupId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...totalsKey(userId, groupId), 'members'],
    enabled: !!userId,
    queryFn: async (): Promise<MemberSpending[]> => {
      const { data, error } = await supabase.rpc('group_member_spending', {
        gid: groupId,
      });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []).map(r => ({
        ...r,
        paid_minor: Number(r.paid_minor),
        share_minor: Number(r.share_minor),
      }));
    },
  });
}

/** The group's whole spending as chart rows (summarize() reads share_minor). */
export const asGroupRows = (rows: GroupSpendingRow[]): InsightRow[] =>
  rows.map(r => ({
    month: r.month,
    category: r.category,
    currency: r.currency,
    share_minor: r.total_minor,
    paid_minor: 0,
    expense_count: r.expense_count,
  }));

export type GroupTotals = {
  total: number;
  myShare: number;
  myPaid: number;
  count: number;
};

/** All-time totals in one currency. */
export function totalsIn(
  rows: GroupSpendingRow[],
  currency: string,
): GroupTotals {
  return rows
    .filter(r => r.currency === currency)
    .reduce(
      (t, r) => ({
        total: t.total + r.total_minor,
        myShare: t.myShare + r.my_share_minor,
        myPaid: t.myPaid + r.my_paid_minor,
        count: t.count + r.expense_count,
      }),
      { total: 0, myShare: 0, myPaid: 0, count: 0 },
    );
}
