import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';

export type ActivityKind =
  | 'expense_added'
  | 'expense_updated'
  | 'expense_deleted'
  | 'expense_restored'
  | 'payment_added'
  | 'payment_deleted'
  | 'payment_restored'
  | 'group_created'
  | 'member_added'
  | 'member_left'
  | 'member_removed';

/** One line of your feed. Names and amounts are as they were at the time. */
export type ActivityItem = {
  id: number;
  kind: ActivityKind;
  created_at: string;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  group_id: string | null;
  group_name: string | null;
  expense_id: string | null;
  description: string | null;
  amount_minor: number | null;
  currency: string | null;
  /** What it did to you: + you lent, − you borrowed, 0 nothing. */
  net_minor: number;
  /** Payments only. */
  paid_by: string | null;
  payer_name: string | null;
  paid_to: string | null;
  payee_name: string | null;
};

export const activityKey = (userId: string | null) =>
  ['activity', userId] as const;

const PAGE = 30;

/** Newest first, a page at a time. */
export function useActivity() {
  const userId = useUserId();
  return useInfiniteQuery({
    queryKey: activityKey(userId),
    enabled: !!userId,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }): Promise<ActivityItem[]> => {
      const { data, error } = await supabase.rpc('list_activity', {
        before_id: pageParam ?? undefined,
        max_rows: PAGE,
      });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []) as ActivityItem[];
    },
    getNextPageParam: last =>
      last.length === PAGE ? last[last.length - 1]!.id : undefined,
  });
}
