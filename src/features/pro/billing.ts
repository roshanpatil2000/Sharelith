import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { reportError } from '@/lib/crashReporting';
import { AppError, toAppError } from '@/features/auth/errors';

/**
 * Google Play Billing, Android only for now (like push and ads). Purchases
 * are checked by the verify-purchase edge function; the app never grants Pro
 * itself.
 */
type IapModule = typeof import('react-native-iap');

export const billingSupported = Platform.OS === 'android';

function iap(): IapModule | null {
  if (!billingSupported) {
    return null;
  }
  try {
    return require('react-native-iap');
  } catch {
    return null;
  }
}

export type ProPlan = {
  sku: string;
  /** Localised price from Play, e.g. "₹49.00". */
  price: string;
  offerToken: string;
};

let connected: Promise<boolean> | null = null;
function connect(m: IapModule): Promise<boolean> {
  connected ??= m.initConnection().catch(e => {
    connected = null;
    throw e;
  });
  return connected;
}

/** The plans Play offers for these IDs, with prices. Missing IDs are left out. */
export async function loadPlans(skus: string[]): Promise<ProPlan[]> {
  const m = iap();
  if (!m) {
    return [];
  }
  await connect(m);
  const products = (await m.fetchProducts({ skus, type: 'subs' })) ?? [];
  const plans: ProPlan[] = [];
  for (const p of products as unknown as {
    id: string;
    subscriptionOffers?: {
      displayPrice: string;
      offerTokenAndroid?: string | null;
    }[];
  }[]) {
    const offer = p.subscriptionOffers?.find(o => o.offerTokenAndroid);
    if (offer?.offerTokenAndroid) {
      plans.push({
        sku: p.id,
        price: offer.displayPrice,
        offerToken: offer.offerTokenAndroid,
      });
    }
  }
  return skus.flatMap(s => plans.filter(p => p.sku === s));
}

/** Sends a purchase token to the server; resolves once Pro status is fresh. */
export async function verifyPurchase(purchaseToken: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<{ is_pro: boolean }>(
    'verify-purchase',
    {
      body: { purchase_token: purchaseToken },
    },
  );
  if (error) {
    throw toAppError(error);
  }
  await queryClient.invalidateQueries({ queryKey: ['pro'] });
  return !!data?.is_pro;
}

/** Opens Google Play's subscribe sheet. The result arrives in listenForPurchases. */
export async function subscribe(plan: ProPlan, userId: string): Promise<void> {
  const m = iap();
  if (!m) {
    throw new AppError(
      'Subscriptions aren’t available on this device yet.',
      'billing_unavailable',
    );
  }
  await connect(m);
  await m.requestPurchase({
    type: 'subs',
    request: {
      google: {
        skus: [plan.sku],
        subscriptionOffers: [{ sku: plan.sku, offerToken: plan.offerToken }],
        // Ties the purchase to this Sharelith account (checked on the server).
        obfuscatedAccountId: userId,
      },
    },
  });
}

type PurchaseHandlers = {
  onVerified: (isPro: boolean) => void;
  onError: (message: string) => void;
};

/** Verifies every purchase Play reports, then finishes it (or Play refunds it in 3 days). */
export function listenForPurchases({
  onVerified,
  onError,
}: PurchaseHandlers): () => void {
  const m = iap();
  if (!m) {
    return () => {};
  }
  const updated = m.purchaseUpdatedListener(purchase => {
    const token = purchase.purchaseToken;
    if (!token) {
      return;
    }
    verifyPurchase(token)
      .then(async isPro => {
        await m
          .finishTransaction({ purchase, isConsumable: false })
          .catch(() => {});
        onVerified(isPro);
      })
      .catch(e => {
        reportError(e, 'Purchase verification failed');
        onError(toAppError(e).message);
      });
  });
  const failed = m.purchaseErrorListener(e => {
    // Closing the sheet isn't an error worth showing.
    if (String(e.code).toLowerCase().includes('cancel')) {
      return;
    }
    onError(e.message || 'The purchase didn’t go through.');
  });
  return () => {
    updated.remove();
    failed.remove();
  };
}

/** "Restore purchases": re-checks the subscriptions this Google account holds. */
export async function restorePurchases(): Promise<boolean> {
  const m = iap();
  if (!m) {
    return false;
  }
  await connect(m);
  const purchases = (await m.getAvailablePurchases()) ?? [];
  let isPro = false;
  for (const p of purchases) {
    if (p.purchaseToken) {
      isPro =
        (await verifyPurchase(p.purchaseToken).catch(() => false)) || isPro;
    }
  }
  return isPro;
}

/** Google Play's manage-subscription page. */
export async function manageSubscription(sku?: string | null): Promise<void> {
  const m = iap();
  await m?.deepLinkToSubscriptions({
    packageNameAndroid: 'com.sharelith.app',
    skuAndroid: sku ?? undefined,
  });
}
