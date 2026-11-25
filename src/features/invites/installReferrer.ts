import { NativeModules, Platform } from 'react-native';
import { storage } from '@/lib/storage';
import { useInviteStore } from './links';

const CHECKED_KEY = 'invite.installReferrerChecked';

/**
 * The invite token in a Play Store install referrer, or null.
 * The invite page sends people to the store with `referrer=invite=<token>`,
 * which reaches the app as `invite=<token>` (sometimes still URL-encoded).
 */
export function inviteFromReferrer(
  referrer: string | null | undefined,
): string | null {
  if (!referrer) {
    return null;
  }
  let text = referrer;
  try {
    text = decodeURIComponent(referrer);
  } catch {
    // Keep it as it was.
  }
  return text.match(/(?:^|&)invite=([A-Za-z0-9_-]{16,64})(?:&|$)/)?.[1] ?? null;
}

type ReferrerModule = { getReferrer: () => Promise<string | null> };

/**
 * Once per install, on Android: if the app was installed from an invite's
 * Play Store link, keep that invite so it's used after sign-up, as if the
 * link had been opened in the app.
 */
export async function captureInstallReferrer(
  os: string = Platform.OS,
  module: ReferrerModule | undefined = NativeModules.InstallReferrer,
): Promise<void> {
  if (os !== 'android' || !module || storage.contains(CHECKED_KEY)) {
    return;
  }
  const referrer = await module.getReferrer().catch(() => null);
  storage.set(CHECKED_KEY, true);
  const token = inviteFromReferrer(referrer);
  // A link opened just now wins over one from the install.
  if (token && !useInviteStore.getState().pendingToken) {
    useInviteStore.getState().setPendingToken(token);
  }
}
