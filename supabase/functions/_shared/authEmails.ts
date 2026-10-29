// Builds Supabase Auth emails (subject, text, HTML, Mailtrap category) for the
// send-auth-email hook. Pure: no Deno or network APIs, so Jest can test it.

export type EmailActionType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email'
  | 'reauthentication'
  | (string & {});

export type EmailData = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: EmailActionType;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

export type BuiltEmail = {
  subject: string;
  text: string;
  html: string;
  /** Mailtrap category, shown in Email Logs and stats. */
  category: string;
};

type Template = {
  subject: string;
  category: string;
  heading: string;
  intro: string;
  button: string;
};

const templates: Record<string, Template> = {
  signup: {
    subject: 'Confirm your email address',
    category: 'Email Confirmation',
    heading: 'Confirm your email address',
    intro:
      'Welcome to Sharelith! Confirm your email to finish creating your account.',
    button: 'Confirm email',
  },
  // Sent by "Confirm email" in the app (signInWithOtp).
  magiclink: {
    subject: 'Confirm your email address',
    category: 'Email Verification',
    heading: 'Confirm your email address',
    intro: 'Confirm this is your email so friends can find you on Sharelith.',
    button: 'Confirm email',
  },
  email: {
    subject: 'Confirm your email address',
    category: 'Email Verification',
    heading: 'Confirm your email address',
    intro: 'Confirm this is your email so friends can find you on Sharelith.',
    button: 'Confirm email',
  },
  recovery: {
    subject: 'Reset your Sharelith password',
    category: 'Password Reset',
    heading: 'Reset your password',
    intro: 'We got a request to reset your Sharelith password.',
    button: 'Reset password',
  },
  email_change: {
    subject: 'Confirm your new email address',
    category: 'Email Change',
    heading: 'Confirm your new email address',
    intro: 'Confirm this address to finish changing your Sharelith email.',
    button: 'Confirm new email',
  },
  invite: {
    subject: 'You’ve been invited to Sharelith',
    category: 'Invite',
    heading: 'You’re invited to Sharelith',
    intro: 'Someone invited you to split expenses on Sharelith.',
    button: 'Accept invite',
  },
  reauthentication: {
    subject: 'Your Sharelith verification code',
    category: 'Reauthentication',
    heading: 'Confirm it’s you',
    intro: 'Use this code to confirm a sensitive change to your account.',
    button: '',
  },
};

const fallback: Template = {
  subject: 'A message from Sharelith',
  category: 'Account Notification',
  heading: 'Account update',
  intro: 'There was an update to your Sharelith account.',
  button: '',
};

/** Link that confirms the token in Supabase and redirects to our bridge page. */
export function confirmationUrl(supabaseUrl: string, data: EmailData): string {
  const params = new URLSearchParams({
    token: data.token_hash,
    type: data.email_action_type,
    redirect_to: data.redirect_to || data.site_url,
  });
  return `${supabaseUrl.replace(
    /\/$/,
    '',
  )}/auth/v1/verify?${params.toString()}`;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]!),
  );

export function buildAuthEmail(
  supabaseUrl: string,
  data: EmailData,
  /** For invites: who sent it, from the invited user's metadata. */
  inviterName?: string,
): BuiltEmail {
  const base = templates[data.email_action_type] ?? fallback;
  const inviter = inviterName?.trim();
  const t =
    data.email_action_type === 'invite' && inviter
      ? {
          ...base,
          subject: `${inviter} invited you to Sharelith`,
          intro: `${inviter} invited you to split expenses on Sharelith. Accept to see what you share and settle up.`,
        }
      : base;
  const link = t.button ? confirmationUrl(supabaseUrl, data) : '';
  const code = data.token;

  const text = [
    t.heading,
    '',
    t.intro,
    '',
    link ? `${t.button}: ${link}` : '',
    code ? `Or enter this code in the app: ${code}` : '',
    '',
    'Open the link on the phone where you use Sharelith.',
    'If you didn’t request this, you can ignore this email.',
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n');

  // Inline styles only: most email clients strip <style> blocks.
  const html = `<!doctype html>
<html><body style="margin:0;background:#F7FAFA;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B2D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#FFFFFF;border-radius:16px;padding:32px 24px">
<tr><td align="center"><div style="width:56px;height:56px;line-height:56px;border-radius:14px;background:#00838A;color:#FFFFFF;font-size:26px;font-weight:700">S</div></td></tr>
<tr><td style="padding-top:20px;font-size:20px;font-weight:700;text-align:center">${escapeHtml(
    t.heading,
  )}</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px;color:#5F7072;text-align:center">${escapeHtml(
    t.intro,
  )}</td></tr>
${
  link
    ? `<tr><td align="center" style="padding-top:24px"><a href="${escapeHtml(
        link,
      )}" style="display:inline-block;background:#00838A;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:10px">${escapeHtml(
        t.button,
      )}</a></td></tr>`
    : ''
}
${
  code
    ? `<tr><td style="padding-top:24px;font-size:13px;color:#5F7072;text-align:center">${
        link ? 'Or enter this code in the app' : 'Your code'
      }</td></tr>
<tr><td style="padding-top:6px;font-size:28px;font-weight:700;letter-spacing:6px;text-align:center">${escapeHtml(
        code,
      )}</td></tr>`
    : ''
}
<tr><td style="padding-top:24px;font-size:12px;line-height:18px;color:#5F7072;text-align:center">Open the link on the phone where you use Sharelith.<br>If you didn’t request this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject: t.subject, text, html, category: t.category };
}
