import { Linking, Platform } from 'react-native';
import Share from 'react-native-share';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppError, toAppError } from '@/features/auth/errors';

/** The invite text, the same whether Sharelith or your phone sends it. */
export const smsInviteText = (inviter: string, link: string) =>
  `${inviter} invited you to split costs on Sharelith: ${link}`;

/** Opens the Messages app at a number with the text filled in. */
export function smsComposerUrl(phone: string, body: string): string {
  const to = phone.replace(/[^\d+]/g, '');
  // iOS reads the body after "&", Android after "?".
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${to}${sep}body=${encodeURIComponent(body)}`;
}

/** Texts from your own phone; the share sheet if there's no Messages app. */
export async function sendFromMyPhone(phone: string, body: string) {
  try {
    await Linking.openURL(smsComposerUrl(phone, body));
  } catch {
    await Share.open({ message: body, failOnCancel: false }).catch(() => {});
  }
}

export type SmsInviteResult = { status: 'sent'; link: string };

/** Sharelith texts the number your invite link (Twilio, server side). */
export async function sendSmsInvite(phone: string): Promise<SmsInviteResult> {
  const { data, error } = await supabase.functions.invoke<SmsInviteResult>(
    'invite-by-sms',
    { body: { phone } },
  );
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      const message: string | undefined = body?.error?.message;
      if (message) {
        throw new AppError(message, body?.error?.code);
      }
    }
    throw toAppError(error);
  }
  return data!;
}

export function useSmsInvite() {
  return useMutation({ mutationFn: sendSmsInvite });
}
