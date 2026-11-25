// The invite-by-SMS request handler: texts someone your invite link. Clients
// and the SMS sender are passed in (no Deno APIs), so Jest can test it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { DAILY_ATTEMPT_LIMIT } from './friends.ts';
import type { SmsMessage } from './twilio.ts';

const INVITE_HOST = 'https://sharelith.techbeas.co.in';

/** Twilio codes for a number it can't text (bad, landline, unverified on trial, blocked). */
const UNREACHABLE = new Set([21211, 21408, 21610, 21612, 21614]);
const TRIAL_UNVERIFIED = 21608;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

/**
 * A phone number in E.164 (+ and 8–15 digits), or null. Spaces, dashes,
 * dots and brackets are dropped; a number without + is taken as Indian.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('00')) {
    digits = `+${digits.slice(2)}`;
  }
  if (!digits.startsWith('+')) {
    digits = digits.replace(/^0+/, '');
    digits = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  }
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export const inviteText = (inviter: string, link: string) =>
  `${inviter} invited you to split costs on Sharelith: ${link}`;

export type SmsInviteDeps = {
  /** Acts as the caller: identifies them and makes their invite link. */
  caller: SupabaseClient;
  /** Service role: the daily limit and the caller's name. */
  admin: SupabaseClient;
  sendSms: (message: SmsMessage) => Promise<unknown>;
};

export async function handleSmsInvite(
  req: Request,
  { caller, admin, sendSms }: SmsInviteDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return fail(405, 'method_not_allowed', 'Method not allowed');
  }
  const { data: auth } = await caller.auth.getUser();
  const me = auth.user;
  if (!me) {
    return fail(401, 'not_signed_in', 'Not signed in');
  }

  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body?.phone);
  if (!phone) {
    return fail(400, 'invalid_phone', 'Enter a valid phone number');
  }

  // Shares the add-friend limit, so texting can't be used to spam.
  const { data: allowed, error: limitError } = await admin.rpc(
    'claim_friend_add_attempt',
    { uid: me.id, daily_limit: DAILY_ATTEMPT_LIMIT },
  );
  if (limitError) {
    console.error('rate limit check failed', limitError);
    return fail(503, 'server', 'Couldn’t send the invite. Try again.');
  }
  if (!allowed) {
    return fail(
      429,
      'rate_limited',
      'You’ve invited a lot of people today. Try again tomorrow.',
    );
  }

  const { data: token, error: linkError } = await caller.rpc(
    'create_invite_link',
    {},
  );
  if (linkError || !token) {
    console.error('invite link failed', linkError);
    return fail(503, 'server', 'Couldn’t send the invite. Try again.');
  }
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', me.id)
    .single();
  const link = `${INVITE_HOST}/invite/${token}`;

  try {
    await sendSms({
      to: phone,
      body: inviteText(profile?.full_name ?? 'A friend', link),
    });
  } catch (e) {
    const code = (e as { code?: number | null }).code ?? null;
    // Not the number itself: keep it out of the logs.
    console.error('sms failed', code, (e as Error).message);
    if (code === TRIAL_UNVERIFIED) {
      return fail(
        422,
        'unverified_number',
        'This number can’t get texts from Sharelith yet.',
      );
    }
    if (code !== null && UNREACHABLE.has(code)) {
      return fail(422, 'unreachable', 'This number can’t receive texts.');
    }
    return fail(502, 'sms_failed', 'Couldn’t send the text. Try again.');
  }

  return json({ status: 'sent', link });
}
