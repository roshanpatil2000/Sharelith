// verify-purchase: the app sends a Play purchase token right after buying (or
// on "Restore"). The server checks it with Google, saves it, and acknowledges
// it. The app never decides Pro by itself.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { saveSubscription, toRow, type PlayApi } from './playBilling.ts';

export type VerifyPurchaseDeps = {
  caller: SupabaseClient;
  admin: SupabaseClient;
  play: PlayApi;
  products: string[];
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

export async function handleVerifyPurchase(
  req: Request,
  { caller, admin, play, products }: VerifyPurchaseDeps,
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
  const token =
    typeof body?.purchase_token === 'string' ? body.purchase_token : '';
  if (!token || token.length > 4096) {
    return fail(400, 'invalid_token', 'Missing purchase token');
  }

  const sub = await play.get(token);
  const row = sub ? toRow(sub, products) : null;
  if (!sub || !row) {
    return fail(400, 'invalid_purchase', 'That purchase couldn’t be verified');
  }
  // Bought from this account? The app passes the user id as the obfuscated account id.
  const owner = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (owner && owner !== me.id) {
    return fail(
      409,
      'other_account',
      'This subscription belongs to another Sharelith account',
    );
  }
  if ((await saveSubscription(admin, me.id, token, row)) === 'taken') {
    return fail(
      409,
      'other_account',
      'This subscription belongs to another Sharelith account',
    );
  }
  if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    await play.acknowledge(row.product_id, token).catch(() => {});
  }
  const { data: isPro } = await admin.rpc('is_pro', { uid: me.id });
  return json({
    is_pro: !!isPro,
    status: row.status,
    expires_at: row.expires_at,
  });
}
