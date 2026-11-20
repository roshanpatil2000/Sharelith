// play-notifications: Google's Real-time Developer Notifications, pushed by a
// Pub/Sub push subscription to this function's URL with ?secret=… . Each one
// only says "this token changed"; we ask Google for the current state and
// update our row, so renewals, cancellations and refunds land without the app.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { saveSubscription, toRow, type PlayApi } from './playBilling.ts';

export type PlayNotificationsDeps = {
  secret: string;
  admin: SupabaseClient;
  play: PlayApi;
  products: string[];
};

const ok = () => new Response('ok');

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

export async function handlePlayNotification(
  req: Request,
  { secret, admin, play, products }: PlayNotificationsDeps,
): Promise<Response> {
  if (
    req.method !== 'POST' ||
    !sameSecret(new URL(req.url).searchParams.get('secret') ?? '', secret)
  ) {
    return new Response('forbidden', { status: 403 });
  }
  const body = await req.json().catch(() => null);
  let note: { subscriptionNotification?: { purchaseToken?: string } } | null =
    null;
  try {
    note = JSON.parse(atob(body?.message?.data ?? ''));
  } catch {
    return ok(); // Not ours; acknowledge so Pub/Sub doesn't retry.
  }
  const token = note?.subscriptionNotification?.purchaseToken;
  if (!token) {
    return ok(); // Test notifications and one-time products.
  }

  const sub = await play.get(token);
  const row = sub ? toRow(sub, products) : null;
  if (!row) {
    // Gone or revoked: expire whatever we had for it.
    await admin
      .from('subscriptions')
      .update({
        status: 'expired',
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('purchase_token', token);
    return ok();
  }
  const { data: existing } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('purchase_token', token)
    .maybeSingle();
  const userId =
    existing?.user_id ??
    sub?.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (userId) {
    await saveSubscription(admin, userId, token, row);
  }
  return ok();
}
