import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { friendsKey } from '@/features/friends/api';
import { groupsKey } from '@/features/groups/api';
import { inviteUrl } from './links';

/** Your invite link (or a group's, if you run it). Reused while it lasts. */
export function useInviteLink(groupId?: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['inviteLink', userId, groupId ?? null],
    enabled: !!userId,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc(
        'create_invite_link',
        groupId ? { gid: groupId } : {},
      );
      if (error || !data) {
        throw toAppError(error);
      }
      return inviteUrl(data);
    },
  });
}

export type RedeemResult = {
  friendId: string;
  groupId: string | null;
  already: boolean;
};

export async function redeemInvite(token: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_invite_link', { token });
  const row = data?.[0];
  if (error || !row) {
    throw toAppError(error);
  }
  return {
    friendId: row.friend_id,
    groupId: row.group_id,
    already: row.already,
  };
}

/** Refreshes friends and groups after an invite was used. */
export function useAfterInvite() {
  const qc = useQueryClient();
  const userId = useUserId();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: friendsKey(userId) }),
      qc.invalidateQueries({ queryKey: groupsKey(userId) }),
    ]);
}
