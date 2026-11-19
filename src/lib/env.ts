import { Platform } from 'react-native';
import Config from 'react-native-config';

/** The Android emulator reaches the host machine at 10.0.2.2, not localhost. */
function hostForPlatform(url: string): string {
  if (Platform.OS !== 'android') {
    return url;
  }
  return url.replace(/\/\/(localhost|127\.0\.0\.1)/, '//10.0.2.2');
}

/** Android build flavour from BuildConfig: 'dev' or 'prod' (iOS: 'prod'). */
const flavor = Config.FLAVOR === 'dev' ? 'dev' : 'prod';

export const env = {
  flavor,
  /** The dev flavour (com.sharelith.app.dev): never real ads. */
  isDevFlavor: flavor === 'dev',
  supabaseUrl: hostForPlatform(Config.SUPABASE_URL ?? 'http://127.0.0.1:54321'),
  supabaseAnonKey: Config.SUPABASE_ANON_KEY ?? '',
  /** Web page that forwards email links into the app (sharelith://). */
  authRedirectUrl:
    Config.AUTH_REDIRECT_URL ??
    'https://sharelith.techbeas.co.in/auth/callback',
  privacyPolicyUrl: 'https://sharelith.techbeas.co.in/privacy',
  termsUrl: 'https://sharelith.techbeas.co.in/terms',
  /**
   * AdMob ad unit IDs for release builds (not secret); .env can override
   * them. Debug builds always use Google's test ads.
   */
  adUnits: {
    interstitial:
      Config.ADMOB_INTERSTITIAL_ID || 'ca-app-pub-8288956475423358/4828424805',
    native: Config.ADMOB_NATIVE_ID || 'ca-app-pub-8288956475423358/9095359912',
  },
};

export const isSupabaseConfigured =
  env.supabaseAnonKey !== '' && env.supabaseAnonKey !== 'replace-with-anon-key';
