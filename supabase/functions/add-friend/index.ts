// Adds a friend by email (instant, like Splitwise). Unknown emails get a
// Supabase invite: the auth user + profile exist right away (marked invited),
// so they can be used in expenses before they accept.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleAddFriend } from '../_shared/addFriendHandler.ts';
import { sendEmail } from '../_shared/mailtrap.ts';

Deno.serve(req => {
  const url = Deno.env.get('SUPABASE_URL')!;
  return handleAddFriend(req, {
    caller: createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }),
    admin: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    }),
    inviteRedirectUrl:
      (Deno.env.get('AUTH_REDIRECT_URL') ??
        'https://sharelith.techbeas.co.in/auth/callback') + '?next=invite',
    sendEmail,
  });
});
