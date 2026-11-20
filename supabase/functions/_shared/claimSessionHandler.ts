// The claim-session request handler: the app calls it right after signing in.
// It keeps the caller's session and ends every other one, tells the old
// devices by push, and emails the person about the sign-in (time, device,
// IP and approximate location).
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
  /** Approximate place for an IP ("Pune, Maharashtra, IN"), or null. */
  locate: (ip: string) => Promise<string | null>;
};

/** What the app says about the device it signed in on. */
export type LoginDevice = {
  platform?: string;
  model?: string;
  os?: string;
  app_version?: string;
};

export type LoginDetails = {
  when: Date;
  ip: string | null;
  location: string | null;
  device: LoginDevice;
  /** How many other devices this sign-in signed out. */
  signedOut: number;
};

/** The caller's public IP, as the edge network saw it. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip') || null;
}

const clean = (v: unknown, max = 80) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

export function parseDevice(raw: unknown): LoginDevice {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    platform: clean(d.platform, 20),
    model: clean(d.model),
    os: clean(d.os, 40),
    app_version: clean(d.app_version, 30),
  };
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

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

export function buildLoginEmail(
  to: { email: string; name?: string },
  login: LoginDetails,
): EmailMessage {
  const name = to.name ? ` ${to.name}` : '';
  const device = [login.device.model, login.device.os]
    .filter(Boolean)
    .join(', ');
  const rows: [string, string][] = [
    ['Time', `${login.when.toUTCString()}`],
    ['Device', device || 'Unknown device'],
    [
      'App',
      login.device.app_version
        ? `Sharelith ${login.device.app_version}`
        : 'Sharelith',
    ],
    ['IP address', login.ip ?? 'Unknown'],
    ['Approximate location', login.location ?? 'Unknown'],
  ];
  const signedOut =
    login.signedOut > 0
      ? 'Sharelith stays signed in on one device at a time, so your other devices were signed out.'
      : null;
  const text = [
    `Hi${name},`,
    '',
    'Your Sharelith account was just signed in:',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    ...(signedOut ? [signedOut, ''] : []),
    'If this was you, there’s nothing to do.',
    'If it wasn’t, reset your password from the Sharelith login screen right away.',
    '',
    'Location is estimated from the IP address and may not be exact.',
    '',
    '— Sharelith',
  ].join('\n');
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#5f6b6d">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(
          v,
        )}</strong></td></tr>`,
    )
    .join('');
  const html = `<p>Hi${escapeHtml(name)},</p>
<p>Your Sharelith account was just signed in:</p>
<table style="border-collapse:collapse">${table}</table>
${signedOut ? `<p>${signedOut}</p>` : ''}
<p>If this was you, there’s nothing to do. If it wasn’t, <strong>reset your password</strong> from the Sharelith login screen right away.</p>
<p style="color:#5f6b6d;font-size:12px">Location is estimated from the IP address and may not be exact.</p>
<p>— Sharelith</p>`;
  return {
    to: [to],
    subject: 'New sign-in to your Sharelith account',
    text,
    html,
    category: 'Security',
  };
}

export async function handleClaimSession(
  req: Request,
  { caller, admin, send, sendEmail, locate }: ClaimSessionDeps,
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
  if (me.email) {
    const ip = clientIp(req.headers);
    const location = ip ? await locate(ip).catch(() => null) : null;
    const name = (me.user_metadata as { full_name?: string } | undefined)
      ?.full_name;
    await sendEmail(
      buildLoginEmail(
        { email: me.email, name },
        {
          when: new Date(),
          ip,
          location,
          device: parseDevice(body?.device),
          signedOut: count,
        },
      ),
    ).catch(() => {});
  }
  return json({ signed_out: count });
}
