import { PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Push is Android only for now: Firebase isn't linked on iOS, so the module
 * is loaded only on Android.
 */
export const pushSupported = Platform.OS === 'android';

type MessagingModule = typeof import('@react-native-firebase/messaging');

function messagingModule(): MessagingModule | null {
  if (!pushSupported) {
    return null;
  }
  try {
    return require('@react-native-firebase/messaging');
  } catch {
    return null;
  }
}

/** What a tapped notification opens. */
export type PushTarget =
  | { screen: 'ExpenseDetail'; expenseId: string }
  | { screen: 'GroupDetail'; groupId: string }
  | { screen: 'FriendDetail'; friendId: string }
  | { screen: 'Activity' };

export function targetFor(
  data: Record<string, unknown> | undefined,
): PushTarget {
  const expenseId = data?.expense_id;
  const groupId = data?.group_id;
  const friendId = data?.friend_id;
  if (typeof expenseId === 'string' && expenseId) {
    return { screen: 'ExpenseDetail', expenseId };
  }
  if (typeof friendId === 'string' && friendId) {
    return { screen: 'FriendDetail', friendId };
  }
  // Removed from a group: it's no longer yours to open.
  if (
    typeof groupId === 'string' &&
    groupId &&
    data?.kind !== 'member_removed'
  ) {
    return { screen: 'GroupDetail', groupId };
  }
  return { screen: 'Activity' };
}

/** Android 13+ asks before showing notifications. */
async function allowNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function saveToken(token: string) {
  const { error } = await supabase.rpc('register_push_token', {
    token,
    platform: Platform.OS,
  });
  if (error) {
    throw error;
  }
}

/**
 * Registers this device for the signed-in user and keeps the token current.
 * Returns a cleanup. Failures (no Firebase config, no Play services, denied
 * permission) just mean no pushes.
 */
export function startPush(): () => void {
  const m = messagingModule();
  if (!m) {
    return () => {};
  }
  let unsubscribe = () => {};
  let stopped = false;
  (async () => {
    try {
      if (!(await allowNotifications()) || stopped) {
        return;
      }
      const messaging = m.getMessaging();
      await saveToken(await m.getToken(messaging));
      if (!stopped) {
        unsubscribe = m.onTokenRefresh(messaging, token => {
          saveToken(token).catch(() => {});
        });
      }
    } catch (e) {
      console.warn('Push registration failed', e);
    }
  })();
  return () => {
    stopped = true;
    unsubscribe();
  };
}

/** Stops pushes to this device. Call while still signed in. */
export async function stopPush(): Promise<void> {
  const m = messagingModule();
  if (!m) {
    return;
  }
  try {
    const messaging = m.getMessaging();
    const token = await m.getToken(messaging);
    await supabase.rpc('unregister_push_token', { token });
    await m.deleteToken(messaging);
  } catch {
    // Signing out must still work offline; the server drops stale tokens
    // when FCM rejects them.
  }
}

type Handlers = {
  open: (target: PushTarget) => void;
  /** A push arrived while the app is open; Android doesn't show it. */
  foreground: (title: string, body: string) => void;
};

/** Follows taps on notifications and pushes that arrive in the foreground. */
export function listenForPushes({ open, foreground }: Handlers): () => void {
  const m = messagingModule();
  if (!m) {
    return () => {};
  }
  try {
    const messaging = m.getMessaging();
    m.getInitialNotification(messaging)
      .then(message => message && open(targetFor(message.data)))
      .catch(() => {});
    const offOpened = m.onNotificationOpenedApp(messaging, message =>
      open(targetFor(message.data)),
    );
    const offMessage = m.onMessage(messaging, message => {
      const { title, body } = message.notification ?? {};
      if (title || body) {
        foreground(title ?? '', body ?? '');
      }
    });
    return () => {
      offOpened();
      offMessage();
    };
  } catch {
    return () => {};
  }
}

/** Android runs this for data in the background; the system shows the notification. */
export function registerBackgroundHandler(): void {
  const m = messagingModule();
  try {
    m?.setBackgroundMessageHandler(m.getMessaging(), async () => {});
  } catch {
    // No Firebase config in this build.
  }
}
