import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesUpdate } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = Pick<
  TablesUpdate<'profiles'>,
  'full_name' | 'phone' | 'avatar_url' | 'default_currency' | 'timezone'
>;

export const profileKey = (userId: string | null) =>
  ['profile', userId] as const;

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single();
      if (error) {
        throw toAppError(error);
      }
      return data;
    },
  });
}

async function updateProfile(
  userId: string,
  patch: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) {
    throw toAppError(error);
  }
  return data;
}

/** Optimistically updates the profile, rolling back on failure. */
export function useUpdateProfile() {
  const userId = useUserId();
  const qc = useQueryClient();
  const key = profileKey(userId);
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => updateProfile(userId!, patch),
    onMutate: async patch => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Profile>(key);
      if (previous) {
        qc.setQueryData<Profile>(key, { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(key, ctx.previous);
      }
    },
    onSuccess: profile => qc.setQueryData(key, profile),
  });
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type PickedImage = { base64: string; type?: string };

/** Types the avatars bucket accepts (see the profiles migration). */
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The image picker reports resized photos as the non-standard "image/jpg"
 * (and they are re-encoded as JPEG). Map to a type Storage accepts.
 */
export function avatarContentType(type?: string): string {
  const normalized = type === 'image/jpg' ? 'image/jpeg' : type;
  return normalized && AVATAR_TYPES.includes(normalized)
    ? normalized
    : 'image/jpeg';
}

/** Uploads a picked image as the user's avatar and saves its URL. */
export function useUploadAvatar() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (image: PickedImage): Promise<Profile> => {
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, base64ToBytes(image.base64), {
          contentType: avatarContentType(image.type),
          upsert: true,
        });
      if (error) {
        throw toAppError(error);
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust: the path stays the same across uploads.
      return updateProfile(userId!, {
        avatar_url: `${data.publicUrl}?v=${Date.now()}`,
      });
    },
    onSuccess: profile => qc.setQueryData(profileKey(userId), profile),
  });
}
