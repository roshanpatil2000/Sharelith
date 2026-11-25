import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';

/** Same rules as the profiles.upi_id check. */
export const UPI_ID = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/;
export const PAYPAL_USERNAME = /^[A-Za-z0-9]{1,20}$/;

export const upiSchema = z
  .string()
  .trim()
  .refine(v => v === '' || UPI_ID.test(v), 'Enter a UPI ID like name@bank.');

/** Accepts "asha", "paypal.me/asha" or the full link. */
export const paypalSchema = z
  .string()
  .trim()
  .transform(v => v.replace(/^(https?:\/\/)?(www\.)?paypal\.me\//i, ''))
  .refine(
    v => v === '' || PAYPAL_USERNAME.test(v),
    'Enter your PayPal.me username.',
  );

const major = (minor: number) => (minor / 100).toFixed(2);

/** Opens the payer's UPI app with everything filled in. INR only. */
export function upiPayUrl(p: {
  upiId: string;
  name: string;
  minor: number;
  note?: string;
}): string {
  const q = [
    ['pa', p.upiId],
    ['pn', p.name],
    ['am', major(p.minor)],
    ['cu', 'INR'],
    ['tn', p.note ?? 'Sharelith'],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return `upi://pay?${q}`;
}

export function paypalPayUrl(p: {
  username: string;
  minor: number;
  currency: string;
}): string {
  return `https://paypal.me/${encodeURIComponent(p.username)}/${major(
    p.minor,
  )}${p.currency}`;
}

export type PayHandles = {
  upi_id: string | null;
  paypal_username: string | null;
};

/** Someone's UPI ID and PayPal username, if they've added them. */
export function usePayHandles(personId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['payHandles', userId, personId ?? null],
    enabled: !!userId && !!personId,
    queryFn: async (): Promise<PayHandles> => {
      const { data, error } = await supabase.rpc('get_pay_handles', {
        uid: personId!,
      });
      if (error) {
        throw toAppError(error);
      }
      return data?.[0] ?? { upi_id: null, paypal_username: null };
    },
  });
}
