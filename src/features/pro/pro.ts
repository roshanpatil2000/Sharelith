import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';

export type ProStatus = {
  isPro: boolean;
  productId: string | null;
  status: string | null;
  expiresAt: string | null;
};

const FREE: ProStatus = {
  isPro: false,
  productId: null,
  status: null,
  expiresAt: null,
};

export const proKey = (userId: string | null) => ['pro', userId] as const;

/** Your Pro status, as the server decides it (subscription or override). */
export function useProStatus() {
  const userId = useUserId();
  return useQuery({
    queryKey: proKey(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ProStatus> => {
      const { data, error } = await supabase.rpc('my_pro_status');
      if (error) {
        throw toAppError(error);
      }
      const row = data?.[0];
      return row
        ? {
            isPro: row.is_pro,
            productId: row.product_id,
            status: row.status,
            expiresAt: row.expires_at,
          }
        : FREE;
    },
  });
}

/** Whether you have Sharelith Pro. False while loading or offline with no cache. */
export function useIsPro(): boolean {
  return useProStatus().data?.isPro ?? false;
}
