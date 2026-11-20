// Google Play subscriptions: the Play Developer API client and the logic both
// edge functions share. The Google client is passed in, so Jest can test it.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** The parts of purchases.subscriptionsv2 we use. */
export type PlaySubscription = {
  subscriptionState?: string;
  acknowledgementState?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
};

export type PlayApi = {
  get: (purchaseToken: string) => Promise<PlaySubscription | null>;
  acknowledge: (productId: string, purchaseToken: string) => Promise<void>;
};

export type SubscriptionStatus =
  | 'active'
  | 'grace'
  | 'on_hold'
  | 'paused'
  | 'expired'
  | 'canceled';

const STATES: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
  SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
};

/** Our row for a Play subscription, or null if it isn't one of ours yet (pending, unknown). */
export function toRow(
  sub: PlaySubscription,
  allowedProducts: string[],
): {
  product_id: string;
  status: SubscriptionStatus;
  expires_at: string;
} | null {
  const status = sub.subscriptionState
    ? STATES[sub.subscriptionState]
    : undefined;
  const item = sub.lineItems?.find(
    l => l.productId && allowedProducts.includes(l.productId),
  );
  if (!status || !item?.productId || !item.expiryTime) {
    return null;
  }
  return { product_id: item.productId, status, expires_at: item.expiryTime };
}

/** Writes the subscription for `userId`, refusing a token that belongs to someone else. */
export async function saveSubscription(
  admin: SupabaseClient,
  userId: string,
  purchaseToken: string,
  row: { product_id: string; status: SubscriptionStatus; expires_at: string },
): Promise<'saved' | 'taken'> {
  const { data: existing } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('purchase_token', purchaseToken)
    .maybeSingle();
  if (existing && existing.user_id !== userId) {
    return 'taken';
  }
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      purchase_token: purchaseToken,
      ...row,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    throw new Error(error.message);
  }
  return 'saved';
}

/** The real Play Developer API (androidpublisher v3). */
export function createPlayApi(
  packageName: string,
  accessToken: () => Promise<string>,
): PlayApi {
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/subscriptions`;
  return {
    get: async token => {
      const res = await fetch(`${base}v2/tokens/${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
      });
      if (res.status === 404 || res.status === 410 || res.status === 400) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`Play API ${res.status}`);
      }
      return (await res.json()) as PlaySubscription;
    },
    acknowledge: async (productId, token) => {
      const res = await fetch(
        `${base}/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
          token,
        )}:acknowledge`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${await accessToken()}` },
        },
      );
      if (!res.ok && res.status !== 400) {
        throw new Error(`Play acknowledge ${res.status}`);
      }
    },
  };
}

export const allowedProducts = (env: string | undefined) =>
  (env ?? 'pro_monthly,pro_yearly')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
