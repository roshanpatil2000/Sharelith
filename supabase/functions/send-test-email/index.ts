// Sends a test email to the signed-in user's own address, to check the
// Mailtrap integration end to end. Only ever emails the caller, so it can't be
// used to send mail to anyone else.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MailtrapError, sendEmail } from '../_shared/mailtrap.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Identify the caller from their session token (forwarded by the app).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    },
  );
  const { data, error } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (error || !email) {
    return json({ error: 'Not signed in' }, 401);
  }

  try {
    const ids = await sendEmail({
      to: [{ email }],
      subject: 'Sharelith test email',
      text:
        'This is a test email from Sharelith.\n\n' +
        'If you can read this, email sending through Mailtrap works.',
      category: 'Integration Test',
    });
    return json({ sent: true, to: email, messageIds: ids });
  } catch (e) {
    const status = e instanceof MailtrapError ? e.status : 500;
    console.error('send-test-email failed:', e);
    return json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      status,
    );
  }
});
