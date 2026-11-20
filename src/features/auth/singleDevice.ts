import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { currentPushToken } from '@/features/push/push';

const CLAIMED_KEY = 'auth.claimedSession';

/** The session id inside a Supabase access token, or null. */
export function sessionIdOf(accessToken: string): string | null {
  const payload = accessToken.split('.')[1];
  if (!payload) {
    return null;
  }
  try {
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
    const claims = JSON.parse(atob(padded));
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Sharelith stays signed in on one device at a time. After a new sign-in,
 * asks the server to sign out every other device (it emails the person if
 * any were). Runs once per session; failures retry on the next sign-in event.
 */
export async function claimSession(accessToken: string): Promise<void> {
  const id = sessionIdOf(accessToken);
  if (!id || storage.getString(CLAIMED_KEY) === id) {
    return;
  }
  const pushToken = await currentPushToken();
  const { error } = await supabase.functions.invoke('claim-session', {
    body: { push_token: pushToken },
  });
  if (!error) {
    storage.set(CLAIMED_KEY, id);
  }
}
