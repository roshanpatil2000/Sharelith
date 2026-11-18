// Sends through FCM HTTP v1, signed in as a Google service account. Uses only
// fetch and Web Crypto.
import type { FcmMessage, FcmResult } from './pushHandler.ts';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

const base64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function signJwt(account: ServiceAccount, now: number): Promise<string> {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = account.private_key
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const input = `${header}.${claims}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(input),
  );
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

/** Returns a sender; the access token is reused until shortly before expiry. */
export function createFcmSender(serviceAccountJson: string) {
  const account = JSON.parse(serviceAccountJson) as ServiceAccount;
  let cached: { token: string; expires: number } | null = null;

  const accessToken = async () => {
    const now = Math.floor(Date.now() / 1000);
    if (cached && cached.expires - 60 > now) {
      return cached.token;
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: await signJwt(account, now),
      }),
    });
    if (!res.ok) {
      throw new Error(`Google token request failed: ${res.status}`);
    }
    const { access_token, expires_in } = await res.json();
    cached = { token: access_token, expires: now + Number(expires_in) };
    return access_token as string;
  };

  return async (message: FcmMessage): Promise<FcmResult> => {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await accessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      },
    );
    if (res.ok) {
      return 'sent';
    }
    // The app was uninstalled or the token replaced.
    if (res.status === 404 || res.status === 410) {
      return 'gone';
    }
    const text = await res.text();
    if (text.includes('UNREGISTERED')) {
      return 'gone';
    }
    console.error('FCM send failed', res.status, text.slice(0, 300));
    return 'failed';
  };
}
