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
  /** Web page that forwards email links into the app (sharelith://). */
  authRedirectUrl:
    Config.AUTH_REDIRECT_URL ??
    'https://sharelith.techbeas.co.in/auth/callback',
  privacyPolicyUrl: 'https://sharelith.techbeas.co.in/privacy',
  termsUrl: 'https://sharelith.techbeas.co.in/terms',
  /**
   * AdMob ad unit IDs for release builds (not secret). Empty means Google's
   * test ads; debug builds always use test ads.
   */
  adUnits: {
    banner: Config.ADMOB_BANNER_ID ?? '',
    interstitial: Config.ADMOB_INTERSTITIAL_ID ?? '',
    native: Config.ADMOB_NATIVE_ID ?? '',
  },
};

export const isSupabaseConfigured =
  env.supabaseAnonKey !== '' && env.supabaseAnonKey !== 'replace-with-anon-key';
