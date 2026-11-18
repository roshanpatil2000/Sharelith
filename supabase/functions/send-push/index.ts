// Sends a push for one activity to one person's devices. Called by the
// database trigger push_activity with the shared secret; not by the app.
//
// Secrets: FCM_SERVICE_ACCOUNT (the Firebase service-account JSON) and
// PUSH_WEBHOOK_SECRET (the same value as Vault's push_webhook_secret).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleSendPush } from '../_shared/pushHandler.ts';
import { createFcmSender } from '../_shared/fcm.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const send = createFcmSender(Deno.env.get('FCM_SERVICE_ACCOUNT')!);

Deno.serve(req =>
  handleSendPush(req, {
    secret: Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '',
    admin,
    send,
  }),
);
