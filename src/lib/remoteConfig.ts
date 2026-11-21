import { Platform } from 'react-native';
import { create } from 'zustand';
import { version as packageVersion } from '../../package.json';

/**
 * The installed app's version (versionName on Android, CFBundleShortVersionString
 * on iOS). Read from the app rather than package.json, so it's right even if
 * a release reused an older JavaScript bundle.
 */
function readInstalledVersion(): string {
  try {
    return require('react-native-device-info').getVersion() || packageVersion;
  } catch {
    return packageVersion;
  }
}
const appVersion = readInstalledVersion();

/**
 * Firebase Remote Config, Android only for now (Firebase isn't linked on
 * iOS). Values start as these defaults and change only after a successful
 * fetch, so the app works the same offline or without Firebase.
 */
export const remoteDefaults = {
  /** Builds older than this must update before they can be used. */
  min_supported_version: '1.0.0',
  /** Where "Update" sends people. */
  update_url: 'https://sharelith.techbeas.co.in',
  /** Show the Remind button on friends who owe you. */
  reminders_enabled: true,
  /** Ask for notification permission and register for push. */
  push_prompt_enabled: true,
  /** Master switch: off hides every ad. */
  ads_enabled: true,
  /** Full-screen ad at natural breaks (navigation, saving an expense). */
  interstitial_enabled: true,
  /** Native ad rows in the Activity feed. */
  native_activity_enabled: true,
  /** Native ad rows in the Groups list. */
  native_groups_enabled: true,
  /** Native ad rows in the Friends list. */
  native_friends_enabled: true,
  /** Minutes between full-screen ads. */
  interstitial_min_minutes: 3,
  /** Ad breaks (navigation, saved expenses) before the first full-screen ad. */
  interstitial_skip_first: 3,
  /** Google Play subscription IDs for Sharelith Pro. */
  pro_monthly_sku: 'pro_monthly',
  pro_yearly_sku: 'pro_yearly',
};

export type RemoteValues = typeof remoteDefaults;

export const useRemoteConfig = create<RemoteValues>(() => remoteDefaults);

export { appVersion };

/**
 * The installed app's build number: the build time in epoch seconds
 * (versionCode on Android, CFBundleVersion on iOS).
 */
export function installedBuildNumber(): string {
  try {
    return require('react-native-device-info').getBuildNumber();
  } catch {
    return '';
  }
}

type RemoteConfigModule = typeof import('@react-native-firebase/remote-config');

function remoteConfigModule(): RemoteConfigModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    return require('@react-native-firebase/remote-config');
  } catch {
    return null;
  }
}

type Config = ReturnType<RemoteConfigModule['getRemoteConfig']>;

/** Reads every key, typed by its default (string, boolean or number). */
function readValues(m: RemoteConfigModule, config: Config): RemoteValues {
  const out: Record<string, string | boolean | number> = {};
  for (const [key, fallback] of Object.entries(remoteDefaults)) {
    const value = m.getValue(config, key);
    out[key] =
      typeof fallback === 'boolean'
        ? value.asBoolean()
        : typeof fallback === 'number'
        ? value.asNumber()
        : value.asString();
  }
  return out as RemoteValues;
}

let unsubscribeUpdates: (() => void) | null = null;

/**
 * Fetches the latest values (at most hourly in release builds), then keeps
 * listening: values published in the console arrive within seconds.
 */
export async function loadRemoteConfig(): Promise<void> {
  const m = remoteConfigModule();
  if (!m) {
    return;
  }
  try {
    const config = m.getRemoteConfig();
    config.settings = {
      minimumFetchIntervalMillis: __DEV__ ? 0 : 60 * 60 * 1000,
      fetchTimeoutMillis: 10_000,
    };
    config.defaultConfig = remoteDefaults;
    await m.fetchAndActivate(config);
    useRemoteConfig.setState(readValues(m, config));
    unsubscribeUpdates ??= m.onConfigUpdate(config, {
      next: () => {
        m.activate(config)
          .then(() => useRemoteConfig.setState(readValues(m, config)))
          .catch(() => {});
      },
      error: () => {},
      complete: () => {},
    });
  } catch {
    // Offline, or no Firebase config in this build: keep the defaults.
  }
}

/** Compares dotted versions: is `current` older than `minimum`? */
export function isOlderVersion(current: string, minimum: string): boolean {
  const parts = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const a = parts(current);
  const b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) {
      return x < y;
    }
  }
  return false;
}
