import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { expensesKey, type ExpenseSummary } from '@/features/expenses/api';

/** Shortest search the server runs. */
export const MIN_SEARCH = 2;

/** Lowercase, trimmed, accents ignored: how names are matched. */
export const fold = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Whether a name contains the search (by fold). */
export const nameMatches = (name: string, query: string) =>
  fold(name).includes(fold(query));

/** The value once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Your expenses and payments matching the search, newest first. */
export function useExpenseSearch(query: string) {
  const userId = useUserId();
  const q = query.trim();
  return useQuery({
    // Under the expenses key, so adding, editing or deleting refreshes it.
    queryKey: [...expensesKey(userId), 'search', q.toLowerCase()],
    enabled: !!userId && q.length >= MIN_SEARCH,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ExpenseSummary[]> => {
      const { data, error } = await supabase.rpc('search_expenses', { q });
      if (error) {
        throw toAppError(error);
      }
      return data ?? [];
    },
  });
}
