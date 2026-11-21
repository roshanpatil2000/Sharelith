import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { expensesKey } from './api';

export type DeletedExpense = {
  id: string;
  group_id: string | null;
  group_name: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  category: string;
  expense_date: string;
  is_payment: boolean;
  deleted_at: string;
};

/** What you deleted, newest first. Under the expenses key, so it refreshes. */
export function useDeletedExpenses() {
  const userId = useUserId();
  return useQuery({
    queryKey: [...expensesKey(userId), 'deleted'],
    enabled: !!userId,
    queryFn: async (): Promise<DeletedExpense[]> => {
      const { data, error } = await supabase.rpc('list_deleted_expenses');
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []).map(r => ({
        ...r,
        amount_minor: Number(r.amount_minor),
      }));
    },
  });
}
