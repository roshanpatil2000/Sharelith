// Mailtrap Email Sending API client for Edge Functions.
// Docs: https://docs.mailtrap.io/getting-started/email-api-smtp.md
//
// Secrets (never ship these in the app):
//   MAILTRAP_API_TOKEN   Mailtrap → Sending Domains → techbeas.co.in → API token
// Optional config:
//   MAILTRAP_FROM_EMAIL  defaults to no-reply@techbeas.co.in (must be on a
//                        verified Mailtrap sending domain)
//   MAILTRAP_FROM_NAME   defaults to "Sharelith"

const SEND_URL = 'https://send.api.mailtrap.io/api/send';

export type EmailAddress = { email: string; name?: string };

export type EmailMessage = {
  to: EmailAddress[];
  subject: string;
  text: string;
  html?: string;
  /** Groups messages in Mailtrap's logs and stats, e.g. "Integration Test". */
  category?: string;
};

export class MailtrapError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'MailtrapError';
  }
}

function sender(): EmailAddress {
  return {
    email: Deno.env.get('MAILTRAP_FROM_EMAIL') ?? 'no-reply@techbeas.co.in',
    name: Deno.env.get('MAILTRAP_FROM_NAME') ?? 'Sharelith',
  };
}

/** Sends one email through Mailtrap; resolves to the message ids. */
export async function sendEmail(message: EmailMessage): Promise<string[]> {
  const token = Deno.env.get('MAILTRAP_API_TOKEN');
  if (!token) {
    throw new MailtrapError('MAILTRAP_API_TOKEN is not set', 500);
  }

  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: sender(), ...message }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    const detail = Array.isArray(body?.errors)
      ? body.errors.join('; ')
      : body?.message ?? res.statusText;
    throw new MailtrapError(`Mailtrap send failed: ${detail}`, res.status);
  }
  return Array.isArray(body?.message_ids) ? body.message_ids : [];
}
