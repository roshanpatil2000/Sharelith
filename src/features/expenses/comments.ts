import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';

export type ExpenseComment = {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author: { full_name: string } | null;
};

export const MAX_COMMENT = 1000;

export const commentsKey = (userId: string | null, expenseId: string) =>
  ['expenseComments', userId, expenseId] as const;

/** An expense's comments, oldest first, kept live while it's open. */
export function useExpenseComments(expenseId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = commentsKey(userId, expenseId);

  useEffect(() => {
    if (!userId) {
      return;
    }
    // A fresh name each time (see activity/liveUpdates.ts).
    const channel = supabase
      .channel(`comments:${expenseId}:${Date.now()}:${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expense_comments',
          filter: `expense_id=eq.${expenseId}`,
        },
        () =>
          qc.invalidateQueries({ queryKey: commentsKey(userId, expenseId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, expenseId, qc]);

  return useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async (): Promise<ExpenseComment[]> => {
      const { data, error } = await supabase
        .from('expense_comments')
        .select(
          'id, author_id, body, created_at, author:profiles!expense_comments_author_id_fkey(full_name)',
        )
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []) as ExpenseComment[];
    },
  });
}

export function useAddComment(expenseId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('expense_comments').insert({
        expense_id: expenseId,
        author_id: userId!,
        body: body.trim(),
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: commentsKey(userId, expenseId) }),
  });
}

export function useDeleteComment(expenseId: string) {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_comments')
        .delete()
        .eq('id', id);
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: commentsKey(userId, expenseId) }),
  });
}
