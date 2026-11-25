// Twilio Programmable Messaging client for Edge Functions.
// Docs: https://www.twilio.com/docs/messaging/api/message-resource
//
// Secrets (never ship these in the app):
//   TWILIO_ACCOUNT_SID   Twilio Console → Account info
//   TWILIO_AUTH_TOKEN    Twilio Console → Account info
// Sender, one of:
//   TWILIO_MESSAGING_SERVICE_SID  a Messaging Service (preferred)
//   TWILIO_FROM                   a Twilio phone number, e.g. +15551234567

export type SmsMessage = { to: string; body: string };

export class TwilioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Twilio's error code, e.g. 21608 for an unverified trial number. */
    readonly code: number | null,
  ) {
    super(message);
    this.name = 'TwilioError';
  }
}

/** Sends one SMS through Twilio; resolves to the message SID. */
export async function sendSms({ to, body }: SmsMessage): Promise<string> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const service = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
  const from = Deno.env.get('TWILIO_FROM');
  if (!sid || !token || (!service && !from)) {
    throw new TwilioError('Twilio is not configured', 500, null);
  }
  const form = new URLSearchParams({ To: to, Body: body });
  if (service) {
    form.set('MessagingServiceSid', service);
  } else {
    form.set('From', from!);
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TwilioError(
      data?.message ?? `Twilio error ${res.status}`,
      res.status,
      typeof data?.code === 'number' ? data.code : null,
    );
  }
  return data.sid as string;
}
