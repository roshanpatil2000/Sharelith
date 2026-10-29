// Pure helpers for the add-friend function (no Deno APIs, so Jest can test).

/** New friendships one person may create per 24 hours (anti-spam). */
export const DAILY_FRIEND_LIMIT = 30;

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const email = input.trim().toLowerCase();
  // Same shape check the app's zod schema uses; Supabase validates again.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254
    ? email
    : null;
}

export function normalizeName(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const name = input.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= 100 ? name : null;
}

/** Friendship rows store the pair once, smallest id first. */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[
        c
      ]!),
  );

/** "Roshan added you as a friend" email for people who already use Sharelith. */
export function buildFriendAddedEmail(
  adderName: string,
  recipientName: string,
): { subject: string; text: string; html: string; category: string } {
  const subject = `${adderName} added you as a friend on Sharelith`;
  const text = [
    `Hi ${recipientName},`,
    '',
    `${adderName} added you as a friend on Sharelith. You can now split expenses with each other.`,
    '',
    'Open the Sharelith app to see them in your friends list.',
  ].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;background:#F7FAFA;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#172B2D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#FFFFFF;border-radius:16px;padding:32px 24px">
<tr><td align="center"><div style="width:56px;height:56px;line-height:56px;border-radius:14px;background:#00838A;color:#FFFFFF;font-size:26px;font-weight:700">S</div></td></tr>
<tr><td style="padding-top:20px;font-size:20px;font-weight:700;text-align:center">${escapeHtml(
    adderName,
  )} added you as a friend</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:22px;color:#5F7072;text-align:center">Hi ${escapeHtml(
    recipientName,
  )}, you can now split expenses with each other on Sharelith. Open the app to see them in your friends list.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html, category: 'Friend Added' };
}
