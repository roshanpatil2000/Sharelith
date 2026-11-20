// The claim-session request handler: the app calls it right after signing in.
// It keeps the caller's session and ends every other one, tells the old
// devices by push, and emails the person if anything was signed out.
// Clients, FCM and email are passed in (no Deno APIs), so Jest can test it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { EmailMessage } from './mailtrap.ts';
import type { FcmMessage, FcmResult } from './pushHandler.ts';

export type ClaimSessionDeps = {
  /** Acts as the caller: only used to identify them. */
  caller: SupabaseClient;
  /** Service role. */
  admin: SupabaseClient;
  send: (message: FcmMessage) => Promise<FcmResult>;
  sendEmail: (message: EmailMessage) => Promise<unknown>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

/** The session id inside a Supabase access token (already verified by getUser). */
export function sessionIdOf(authorization: string | null): string | null {
  const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(
      atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')),
    );
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

export const SIGNED_OUT_TITLE = 'Signed out of Sharelith';
export const SIGNED_OUT_BODY =
  'Your account was signed in on another device, so this one was signed out.';

export function buildSignedOutElsewhereEmail(
  to: { email: string; name?: string },
  when: Date,
): EmailMessage {
  const time = when.toUTCString();
  const name = to.name ? ` ${to.name}` : '';
  const text = [
    `Hi${name},`,
    '',
    `Your Sharelith account was signed in on a new device (${time}).`,
    'Sharelith stays signed in on one device at a time, so your other devices were signed out.',
    '',
    'If this was you, there’s nothing to do.',
    'If it wasn’t, reset your password from the Sharelith login screen right away.',
    '',
    '— Sharelith',
  ].join('\n');
  const html = `<p>Hi${name},</p>
<p>Your Sharelith account was signed in on a new device (${time}).</p>
<p>Sharelith stays signed in on one device at a time, so your other devices were signed out.</p>
<p>If this was you, there’s nothing to do. If it wasn’t, <strong>reset your password</strong> from the Sharelith login screen right away.</p>
<p>— Sharelith</p>`;
  return {
    to: [to],
    subject: 'Your Sharelith account was signed in on a new device',
    text,
    html,
    category: 'Security',
  };
}

export async function handleClaimSession(
  req: Request,
  { caller, admin, send, sendEmail }: ClaimSessionDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return fail(405, 'method_not_allowed', 'Method not allowed');
  }
  const { data: auth } = await caller.auth.getUser();
  const me = auth.user;
  const session = sessionIdOf(req.headers.get('Authorization'));
  if (!me || !session) {
    return fail(401, 'not_signed_in', 'Not signed in');
  }
  const body = await req.json().catch(() => ({}));
  const myToken = typeof body?.push_token === 'string' ? body.push_token : null;

  const { data: ended, error } = await admin.rpc('end_other_sessions', {
    uid: me.id,
    keep: session,
  });
  if (error) {
    return fail(500, 'claim_failed', 'Couldn’t sign out other devices');
  }

  // Tell the other devices, then stop pushing to them.
  const { data: rows } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', me.id);
  const others = (rows ?? [])
    .map((r: { token: string }) => r.token)
    .filter((t: string) => t !== myToken);
  await Promise.all(
    others.map((token: string) =>
      send({
        token,
        notification: { title: SIGNED_OUT_TITLE, body: SIGNED_OUT_BODY },
        data: { type: 'signed_out' },
        android: { priority: 'HIGH', notification: { tag: 'signed_out' } },
      }).catch(() => 'failed'),
    ),
  );
  if (others.length > 0) {
    await admin.from('push_tokens').delete().in('token', others);
  }

  const count = Number(ended ?? 0);
  if (count > 0 && me.email) {
    const name = (me.user_metadata as { full_name?: string } | undefined)
      ?.full_name;
    await sendEmail(
      buildSignedOutElsewhereEmail({ email: me.email, name }, new Date()),
    ).catch(() => {});
  }
  return json({ signed_out: count });
}
