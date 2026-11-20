import { Platform } from 'react-native';
import { appVersion } from '@/lib/remoteConfig';
import { env } from '@/lib/env';
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

/** What the sign-in alert email says about this device. */
export function deviceInfo() {
  const c = Platform.constants as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  if (Platform.OS === 'android') {
    const brand = str(c.Manufacturer) ?? str(c.Brand);
    const model = str(c.Model);
    return {
      platform: 'android',
      model: [brand, model].filter(Boolean).join(' ') || 'Android phone',
      os: `Android ${str(c.Release) ?? ''}`.trim(),
      app_version: env.isDevFlavor ? `${appVersion} (dev)` : appVersion,
    };
  }
  const idiom = str(c.interfaceIdiom);
  return {
    platform: Platform.OS,
    model: idiom === 'pad' ? 'iPad' : 'iPhone',
    os: `${str(c.systemName) ?? 'iOS'} ${str(c.osVersion) ?? ''}`.trim(),
    app_version: appVersion,
  };
}

/**
 * Sharelith stays signed in on one device at a time. After a new sign-in,
 * asks the server to sign out every other device; it also emails the person
 * a sign-in alert with this device's details. Runs once per session; failures retry on the next sign-in event.
 */
export async function claimSession(accessToken: string): Promise<void> {
  const id = sessionIdOf(accessToken);
  if (!id || storage.getString(CLAIMED_KEY) === id) {
    return;
  }
  const pushToken = await currentPushToken();
  const { error } = await supabase.functions.invoke('claim-session', {
    body: { push_token: pushToken, device: deviceInfo() },
  });
  if (!error) {
    storage.set(CLAIMED_KEY, id);
  }
}
