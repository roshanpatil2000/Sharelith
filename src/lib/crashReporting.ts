import { Platform } from 'react-native';

/**
 * Firebase Crashlytics, Android only for now (Firebase isn't linked on iOS).
 * Crashes and unhandled JS errors are reported on their own; this adds who
 * hit them and errors the app caught but didn't expect.
 */
type CrashlyticsModule = typeof import('@react-native-firebase/crashlytics');

function crashlytics(): CrashlyticsModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return require('@react-native-firebase/crashlytics');
  } catch {
    return null;
  }
}

/** Tags reports with the account id (never the name or email). */
export function setCrashUser(userId: string | null): void {
  const m = crashlytics();
  try {
    m?.setUserId(m.getCrashlytics(), userId ?? '').catch(() => {});
  } catch {
    // No Firebase config in this build.
  }
}

/** Records an error the app recovered from, as a non-fatal report. */
export function reportError(error: unknown, context?: string): void {
  const m = crashlytics();
  if (!m) {
    return;
  }
  try {
    const instance = m.getCrashlytics();
    if (context) {
      m.log(instance, context);
    }
    m.recordError(
      instance,
      error instanceof Error ? error : new Error(String(error)),
    );
  } catch {
    // No Firebase config in this build.
  }
}
