// The send-push request handler. Called by the database (pg_net) with a shared
// secret, for one activity and one recipient. Clients and FCM are passed in
// (no Deno APIs), so Jest can test it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { pushText, type PushActivity } from './pushText.ts';

export type FcmMessage = {
  token: string;
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: { priority: 'HIGH'; notification: { tag: string } };
};

/** What FCM said about one token. */
export type FcmResult = 'sent' | 'gone' | 'failed';

export type SendPushDeps = {
  /** Must match the x-push-secret header. */
  secret: string;
  /** Service role. */
  admin: SupabaseClient;
  send: (message: FcmMessage) => Promise<FcmResult>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Compares without leaking how much matched through timing. */
function sameSecret(a: string, b: string): boolean {
  if (!a || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

type ActivityRow = PushActivity & {
  actor_id: string | null;
  group_id: string | null;
  expense_id: string | null;
  actor: { full_name: string } | null;
};

export async function handleSendPush(
  req: Request,
  { secret, admin, send }: SendPushDeps,
): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method' }, 405);
  }
  if (!sameSecret(req.headers.get('x-push-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401);
  }
  let body: { activity_id?: unknown; user_id?: unknown; net_minor?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const activityId = Number(body.activity_id);
  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  const net = Number(body.net_minor ?? 0);
  if (!Number.isInteger(activityId) || !userId || !Number.isFinite(net)) {
    return json({ error: 'bad_request' }, 400);
  }

  const { data: activity, error } = await admin
    .from('activities')
    .select(
      'kind, actor_id, group_id, expense_id, group_name, description, amount_minor, currency, note, actor:profiles!activities_actor_id_fkey(full_name)',
    )
    .eq('id', activityId)
    .maybeSingle<ActivityRow>();
  if (error || !activity) {
    return json({ error: 'not_found' }, 404);
  }

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);
  if (!tokens?.length) {
    return json({ sent: 0 });
  }

  const text = pushText(
    { ...activity, actor_name: activity.actor?.full_name ?? null },
    net,
  );
  const data: Record<string, string> = { kind: activity.kind };
  if (activity.group_id) {
    data.group_id = activity.group_id;
  }
  if (activity.kind === 'reminder' && activity.actor_id) {
    data.friend_id = activity.actor_id;
  }
  if (activity.expense_id && !activity.kind.endsWith('_deleted')) {
    data.expense_id = activity.expense_id;
  }

  const results = await Promise.all(
    tokens.map(({ token }: { token: string }) =>
      send({
        token,
        notification: text,
        data,
        // Repeat changes to one expense replace each other.
        android: {
          priority: 'HIGH',
          notification: {
            tag: activity.expense_id ?? `activity-${activityId}`,
          },
        },
      }).then(result => ({ token, result })),
    ),
  );

  const gone = results.filter(r => r.result === 'gone').map(r => r.token);
  if (gone.length) {
    await admin.from('push_tokens').delete().in('token', gone);
  }
  return json({
    sent: results.filter(r => r.result === 'sent').length,
    removed: gone.length,
  });
}
