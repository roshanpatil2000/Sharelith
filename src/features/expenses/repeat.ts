import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { longDate } from '@/domain/dates';

export type Frequency = 'weekly' | 'monthly' | 'yearly';
export type RepeatChoice = Frequency | 'never';

export type ExpenseRepeat = { frequency: Frequency; next_date: string };

export const repeatOptions = [
  { value: 'never', label: 'Never' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
] as const;

const adverb: Record<Frequency, string> = {
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'yearly',
};

/** "Repeats monthly · next on 21 December 2026". */
export const repeatSummary = (r: ExpenseRepeat) =>
  `Repeats ${adverb[r.frequency]} · next on ${longDate(r.next_date)}`;

export const repeatKey = (userId: string | null, expenseId: string) =>
  ['expenseRepeat', userId, expenseId] as const;

/** Whether this expense repeats (only its newest copy carries the repeat). */
export function useExpenseRepeat(expenseId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: repeatKey(userId, expenseId),
    enabled: !!userId,
    queryFn: async (): Promise<ExpenseRepeat | null> => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('frequency, next_date')
        .eq('last_expense_id', expenseId)
        .maybeSingle();
      if (error) {
        throw toAppError(error);
      }
      return (data as ExpenseRepeat | null) ?? null;
    },
  });
}

export function useSetRepeat(expenseId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (choice: RepeatChoice) => {
      const { error } = await supabase.rpc('set_expense_repeat', {
        eid: expenseId,
        frequency: choice === 'never' ? null : choice,
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: repeatKey(userId, expenseId) }),
  });
}
