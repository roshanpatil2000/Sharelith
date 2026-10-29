// Supabase Auth "Send Email Hook": Auth calls this instead of SMTP for every
// auth email, and we send it through Mailtrap with a category.
// Docs: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
//
// Secrets: SEND_EMAIL_HOOK_SECRET (from the hook settings, "v1,whsec_…"),
//          MAILTRAP_API_TOKEN (shared with other functions).
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { buildAuthEmail, type EmailData } from '../_shared/authEmails.ts';
import { MailtrapError, sendEmail } from '../_shared/mailtrap.ts';

type HookPayload = {
  user: { email: string; user_metadata?: { full_name?: string } };
  email_data: EmailData;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json(
      { error: { http_code: 405, message: 'Method not allowed' } },
      405,
    );
  }

  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  if (!secret) {
    return json(
      { error: { http_code: 500, message: 'Hook secret not set' } },
      500,
    );
  }

  // Only Supabase Auth can produce a valid signature.
  let payload: HookPayload;
  try {
    const wh = new Webhook(secret.replace('v1,whsec_', ''));
    payload = wh.verify(
      await req.text(),
      Object.fromEntries(req.headers),
    ) as HookPayload;
  } catch {
    return json(
      { error: { http_code: 401, message: 'Invalid signature' } },
      401,
    );
  }

  const { user, email_data } = payload;
  try {
    const email = buildAuthEmail(Deno.env.get('SUPABASE_URL')!, email_data);
    await sendEmail({
      to: [{ email: user.email, name: user.user_metadata?.full_name }],
      subject: email.subject,
      text: email.text,
      html: email.html,
      category: email.category,
    });
    return json({});
  } catch (e) {
    console.error('send-auth-email failed:', e);
    const status = e instanceof MailtrapError ? e.status : 500;
    return json(
      { error: { http_code: status, message: 'Could not send email' } },
      500,
    );
  }
});
