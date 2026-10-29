import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { AppError, toAppError } from '@/features/auth/errors';

export type Friend = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  /** Invited by email but hasn't accepted yet. */
  invited: boolean;
  friends_since: string;
};

export const friendsKey = (userId: string | null) =>
  ['friends', userId] as const;

export function useFriends() {
  const userId = useUserId();
  return useQuery({
    queryKey: friendsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Friend[]> => {
      const { data, error } = await supabase.rpc('list_friends');
      if (error) {
        throw toAppError(error);
      }
      return data ?? [];
    },
  });
}

export function useFriend(friendId: string) {
  const query = useFriends();
  return { ...query, data: query.data?.find(f => f.id === friendId) };
}

export type AddFriendInput = { email: string; name?: string };
export type AddFriendResult =
  | { status: 'added' | 'invited' | 'already_friends'; friend: Friend }
  | { status: 'needs_name' };

/** Calls the add-friend Edge Function (instant add, or email invite). */
export async function addFriend(
  input: AddFriendInput,
): Promise<AddFriendResult> {
  const { data, error } = await supabase.functions.invoke<AddFriendResult>(
    'add-friend',
    { body: input },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      const code: string | undefined = body?.error?.code;
      const message: string | undefined = body?.error?.message;
      if (message) {
        throw new AppError(message, code);
      }
    }
    throw toAppError(error);
  }
  return data!;
}

export function useAddFriend() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addFriend,
    onSuccess: result => {
      if (result.status !== 'needs_name') {
        qc.invalidateQueries({ queryKey: friendsKey(userId) });
      }
    },
  });
}

export function useRemoveFriend() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = friendsKey(userId);
  return useMutation({
    mutationFn: async (friendId: string) => {
      const { error } = await supabase.rpc('remove_friend', {
        friend: friendId,
      });
      if (error) {
        throw toAppError(error);
      }
    },
    onMutate: async friendId => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Friend[]>(key);
      qc.setQueryData<Friend[]>(key, old =>
        old?.filter(f => f.id !== friendId),
      );
      return { previous };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(key, ctx.previous);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
