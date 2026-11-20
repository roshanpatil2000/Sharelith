// Google Play Real-time Developer Notifications (Pub/Sub push). See
// _shared/playNotificationsHandler.ts.
//
// Secrets: PLAY_SERVICE_ACCOUNT, PLAY_NOTIFICATIONS_SECRET (the ?secret= in
// the Pub/Sub push URL). Optional: PLAY_PACKAGE_NAME, PRO_PRODUCT_IDS.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createGoogleTokenSource } from '../_shared/googleAuth.ts';
import { allowedProducts, createPlayApi } from '../_shared/playBilling.ts';
import { handlePlayNotification } from '../_shared/playNotificationsHandler.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false },
  },
);
const play = createPlayApi(
  Deno.env.get('PLAY_PACKAGE_NAME') ?? 'com.sharelith.app',
  createGoogleTokenSource(
    Deno.env.get('PLAY_SERVICE_ACCOUNT')!,
    'https://www.googleapis.com/auth/androidpublisher',
  ),
);

Deno.serve(req =>
  handlePlayNotification(req, {
    secret: Deno.env.get('PLAY_NOTIFICATIONS_SECRET') ?? '',
    admin,
    play,
    products: allowedProducts(Deno.env.get('PRO_PRODUCT_IDS')),
  }),
);
