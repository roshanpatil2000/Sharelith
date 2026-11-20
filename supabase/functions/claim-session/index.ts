// Keeps one signed-in device per account. The app calls this right after a
// sign-in; see _shared/claimSessionHandler.ts.
//
// Secrets: FCM_SERVICE_ACCOUNT and MAILTRAP_API_TOKEN (already set for
// send-push and the auth emails).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleClaimSession } from '../_shared/claimSessionHandler.ts';
import { createFcmSender } from '../_shared/fcm.ts';
import { sendEmail } from '../_shared/mailtrap.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const send = createFcmSender(Deno.env.get('FCM_SERVICE_ACCOUNT')!);

Deno.serve(req =>
  handleClaimSession(req, {
    caller: createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }),
    admin,
    send,
    sendEmail,
  }),
);
