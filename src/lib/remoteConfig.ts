import { Platform } from 'react-native';
import { create } from 'zustand';
import { version as appVersion } from '../../package.json';

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
};

export type RemoteValues = typeof remoteDefaults;

export const useRemoteConfig = create<RemoteValues>(() => remoteDefaults);

export { appVersion };

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

/** Fetches the latest values (at most hourly in release builds). */
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
    useRemoteConfig.setState({
      min_supported_version: m
        .getValue(config, 'min_supported_version')
        .asString(),
      update_url: m.getValue(config, 'update_url').asString(),
      reminders_enabled: m.getValue(config, 'reminders_enabled').asBoolean(),
      push_prompt_enabled: m
        .getValue(config, 'push_prompt_enabled')
        .asBoolean(),
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
