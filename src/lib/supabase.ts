import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';
import { asyncStorage } from './storage';
import type { Database } from './database.types';

export const supabase = createClient<Database>(
  env.supabaseUrl,
  // createClient throws on an empty key; the app shows a setup banner instead.
  env.supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      storage: asyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
