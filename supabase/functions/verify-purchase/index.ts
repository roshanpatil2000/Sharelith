// Verifies a Google Play subscription purchase for the signed-in user.
// See _shared/verifyPurchaseHandler.ts.
//
// Secrets: PLAY_SERVICE_ACCOUNT (Google service-account JSON with access to
// the app in Play Console). Optional: PLAY_PACKAGE_NAME (default
// com.sharelith.app), PRO_PRODUCT_IDS (default pro_monthly,pro_yearly).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGoogleTokenSource } from '../_shared/googleAuth.ts';
import { allowedProducts, createPlayApi } from '../_shared/playBilling.ts';
import { handleVerifyPurchase } from '../_shared/verifyPurchaseHandler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const play = createPlayApi(
  Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.sharelith.app',
  createGoogleTokenSource(
    Deno.env.get('PLAY_SERVICE_ACCOUNT')!,
    'https://www.googleapis.com/auth/androidpublisher',
  ),
);

Deno.serve(req =>
  handleVerifyPurchase(req, {
    caller: createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }),
    admin,
    play,
    products: allowedProducts(Deno.env.get('PRO_PRODUCT_IDS')),
  }),
);
