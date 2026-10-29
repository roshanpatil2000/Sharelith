import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import {
  avatarContentType,
  base64ToBytes,
  type PickedImage,
} from '@/features/account/api';
import { friendsKey } from '@/features/friends/api';
import type { GroupType } from './groupTypes';

export type Group = Omit<Tables<'groups'>, 'type'> & { type: GroupType };
export type GroupSummary = Group & { member_count: number };

export type GroupMember = {
  id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  /** Invited by email but hasn't accepted yet. */
  invited: boolean;
  joined_at: string;
};
export type GroupDetail = Group & { members: GroupMember[] };

export type GroupEdit = Partial<
  Pick<Group, 'name' | 'description' | 'type' | 'cover_url' | 'simplify_debts'>
>;

export const groupsKey = (userId: string | null) => ['groups', userId] as const;
export const groupKey = (userId: string | null, groupId: string) =>
  ['groups', userId, groupId] as const;

const GROUP_COLUMNS =
  'id, name, description, type, cover_url, currency, simplify_debts, created_by, created_at, updated_at';

export function useGroups() {
  const userId = useUserId();
  return useQuery({
    queryKey: groupsKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<GroupSummary[]> => {
      const { data, error } = await supabase
        .from('groups')
        .select(`${GROUP_COLUMNS}, group_members(count)`)
        .order('updated_at', { ascending: false });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []).map(({ group_members, ...g }) => ({
        ...(g as Group),
        member_count: group_members[0]?.count ?? 0,
      }));
    },
  });
}

export function useGroup(groupId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: groupKey(userId, groupId),
    enabled: !!userId,
    queryFn: async (): Promise<GroupDetail | null> => {
      const { data, error } = await supabase
        .from('groups')
        .select(
          `${GROUP_COLUMNS}, group_members(joined_at, profile:profiles!group_members_user_id_fkey(id, full_name, email, avatar_url, joined_at))`,
        )
        .eq('id', groupId)
        .maybeSingle();
      if (error) {
        throw toAppError(error);
      }
      if (!data) {
        return null;
      }
      const { group_members, ...g } = data;
      const members = group_members
        .filter(m => m.profile)
        .map(m => ({
          id: m.profile!.id,
          full_name: m.profile!.full_name,
          email: m.profile!.email,
          avatar_url: m.profile!.avatar_url,
          invited: m.profile!.joined_at === null,
          joined_at: m.joined_at,
        }))
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      return { ...(g as Group), members };
    },
  });
}

/** Membership changes add friendships too, so both lists refresh. */
function useInvalidateGroups() {
  const userId = useUserId();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: groupsKey(userId) }),
      qc.invalidateQueries({ queryKey: friendsKey(userId) }),
    ]);
}

async function rpc<T>(
  call: PromiseLike<{ data: T; error: unknown }>,
): Promise<T> {
  const { data, error } = await call;
  if (error) {
    throw toAppError(error);
  }
  return data;
}

export type CreateGroupInput = {
  name: string;
  type: GroupType;
  description?: string;
  memberIds: string[];
};

export function useCreateGroup() {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: async (input: CreateGroupInput): Promise<string> => {
      const groupId = await rpc(
        supabase.rpc('create_group', {
          name: input.name,
          type: input.type,
          description: input.description,
          member_ids: input.memberIds,
        }),
      );
      return groupId!;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateGroup(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: async (patch: GroupEdit) => {
      const { error } = await supabase
        .from('groups')
        .update(patch)
        .eq('id', groupId);
      if (error) {
        throw toAppError(error);
      }
    },
    onSuccess: invalidate,
  });
}

export function useAddGroupMembers(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (memberIds: string[]) =>
      rpc(
        supabase.rpc('add_group_members', {
          gid: groupId,
          member_ids: memberIds,
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveGroupMember(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (memberId: string) =>
      rpc(
        supabase.rpc('remove_group_member', { gid: groupId, member: memberId }),
      ),
    onSuccess: invalidate,
  });
}

export function useLeaveGroup(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: () => rpc(supabase.rpc('leave_group', { gid: groupId })),
    onSuccess: invalidate,
  });
}

export function useDeleteGroup(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: async () => {
      // Best effort: the cover file isn't removed by deleting the row.
      await supabase.storage
        .from('group-covers')
        .remove([`${groupId}/cover.jpg`]);
      await rpc(supabase.rpc('delete_group', { gid: groupId }));
    },
    onSuccess: invalidate,
  });
}

/** Uploads a picked image as the group's cover and saves its URL. */
export async function uploadGroupCover(
  groupId: string,
  image: PickedImage,
): Promise<void> {
  const path = `${groupId}/cover.jpg`;
  const { error } = await supabase.storage
    .from('group-covers')
    .upload(path, base64ToBytes(image.base64), {
      contentType: avatarContentType(image.type),
      upsert: true,
    });
  if (error) {
    throw toAppError(error);
  }
  const { data } = supabase.storage.from('group-covers').getPublicUrl(path);
  // Cache-bust: the path stays the same across uploads.
  const { error: updateError } = await supabase
    .from('groups')
    .update({ cover_url: `${data.publicUrl}?v=${Date.now()}` })
    .eq('id', groupId);
  if (updateError) {
    throw toAppError(updateError);
  }
}

export function useUploadGroupCover(groupId: string) {
  const invalidate = useInvalidateGroups();
  return useMutation({
    mutationFn: (image: PickedImage) => uploadGroupCover(groupId, image),
    onSuccess: invalidate,
  });
}

/** Whether the signed-in user is this group's admin. */
export function useIsGroupAdmin(group: Pick<Group, 'created_by'> | undefined) {
  const userId = useUserId();
  return !!group && !!userId && group.created_by === userId;
}
