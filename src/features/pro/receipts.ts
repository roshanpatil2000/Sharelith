import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { base64ToBytes, type PickedImage } from '@/features/account/api';
import { toAppError } from '@/features/auth/errors';

const BUCKET = 'receipts';
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Storage path for a new receipt: <expense_id>/receipt-<time>.<ext>. */
export function receiptPath(
  expenseId: string,
  type?: string,
  now = Date.now(),
): string {
  const ext =
    type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return `${expenseId}/receipt-${now}.${ext}`;
}

/** A short-lived link to view a receipt (the bucket is private). */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['receipt-url', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path!, 60 * 60);
      if (error) {
        throw toAppError(error);
      }
      return data.signedUrl;
    },
  });
}

/** Uploads a photo and attaches it to the expense, removing any old one. */
export function useSetReceipt(expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      image,
      previous,
    }: {
      image: PickedImage | null;
      previous?: string | null;
    }) => {
      let path: string | null = null;
      if (image) {
        const type =
          image.type === 'image/jpg' || !TYPES.includes(image.type ?? '')
            ? 'image/jpeg'
            : image.type!;
        path = receiptPath(expenseId, type);
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, base64ToBytes(image.base64), {
            contentType: type,
            upsert: true,
          });
        if (error) {
          throw toAppError(error);
        }
      }
      const { error } = await supabase.rpc('set_expense_receipt', {
        eid: expenseId,
        path,
      });
      if (error) {
        throw toAppError(error);
      }
      if (previous && previous !== path) {
        await supabase.storage.from(BUCKET).remove([previous]);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expense'] }),
  });
}
