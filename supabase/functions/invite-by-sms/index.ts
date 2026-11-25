// Texts a phone number your invite link (Twilio). The number isn't stored.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleSmsInvite } from '../_shared/smsInviteHandler.ts';
import { sendSms } from '../_shared/twilio.ts';

Deno.serve(req => {
  const url = Deno.env.get('SUPABASE_URL')!;
  return handleSmsInvite(req, {
    caller: createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }),
    admin: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    }),
    sendSms,
  });
});
