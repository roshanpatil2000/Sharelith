import { Platform } from 'react-native';
import Config from 'react-native-config';

/** The Android emulator reaches the host machine at 10.0.2.2, not localhost. */
function hostForPlatform(url: string): string {
  if (Platform.OS !== 'android') {
    return url;
  }
  return url.replace(/\/\/(localhost|127\.0\.0\.1)/, '//10.0.2.2');
}

export const env = {
  supabaseUrl: hostForPlatform(Config.SUPABASE_URL ?? 'http://127.0.0.1:54321'),
  supabaseAnonKey: Config.SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured =
  env.supabaseAnonKey !== '' && env.supabaseAnonKey !== 'replace-with-anon-key';
