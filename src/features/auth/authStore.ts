import { isAuthSessionMissingError, type Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setCrashUser } from '@/lib/crashReporting';
import { clearQueryCache } from '@/lib/queryClient';
import { zustandStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/feedback/Toast';
import { claimSession } from './singleDevice';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  session: Session | null;
  /** False until the stored session has been read on launch. */
  ready: boolean;
  /**
   * True while the password-reset flow runs. Verifying the reset code signs
   * the user in before the new password is saved; this keeps the auth screens
   * mounted until that finishes.
   */
  recovering: boolean;
  /**
   * Set after opening a password-reset link: the user is signed in but must
   * choose a new password before using the app. Persisted, so closing the app
   * can't skip that step.
   */
  passwordResetPending: false | 'reset' | 'invite';
  /**
   * Set by logging in or signing up (not by reopening the app signed in):
   * the welcome pages show until finished. Persisted, so closing the app
   * part-way brings them back.
   */
  welcomePending: boolean;
  finishWelcome: () => void;
  setSession: (session: Session | null) => void;
  setRecovering: (recovering: boolean) => void;
  setPasswordResetPending: (pending: false | 'reset' | 'invite') => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      session: null,
      ready: false,
      recovering: false,
      passwordResetPending: false,
      welcomePending: false,
      finishWelcome: () => set({ welcomePending: false }),
      setSession: session =>
        set(s => ({
          session,
          ready: true,
          passwordResetPending: session ? s.passwordResetPending : false,
          // Until `ready`, a session is the saved one being read, not a login.
          welcomePending:
            !!session && (s.welcomePending || (s.ready && !s.session)),
        })),
      setRecovering: recovering => set({ recovering }),
      setPasswordResetPending: passwordResetPending =>
        set({ passwordResetPending }),
    }),
    {
      name: 'auth-flow',
      storage: createJSONStorage(() => zustandStorage),
      partialize: s => ({
        passwordResetPending: s.passwordResetPending,
        welcomePending: s.welcomePending,
      }),
    },
  ),
);

export function selectStatus(s: AuthState): AuthStatus {
  if (!s.ready) {
    return 'loading';
  }
  return s.session && !s.recovering ? 'signedIn' : 'signedOut';
}

export const useAuthStatus = () => useAuthStore(selectStatus);
export const useUserId = () => useAuthStore(s => s.session?.user.id ?? null);
export const useUserEmail = () =>
  useAuthStore(s => s.session?.user.email ?? null);

/** What Supabase answers when the signed-in user or session no longer exists. */
const goneAccountCodes = new Set(['user_not_found', 'session_not_found']);

/**
 * A saved session outlives its account: it keeps working on this device until
 * it expires, even after the account is deleted elsewhere. Asks the server, and
 * signs out only when it says the account or session is gone, never because
 * the network failed.
 */
export async function signOutIfAccountGone(): Promise<void> {
  if (!useAuthStore.getState().session) {
    return;
  }
  const { error } = await supabase.auth.getUser();
  if (!error) {
    return;
  }
  // The server ended this session: someone signed in on another device.
  // supabase-js reports that as AuthSessionMissingError and has already
  // cleared the session.
  if (isAuthSessionMissingError(error)) {
    await supabase.auth.signOut({ scope: 'local' });
    toast.show(
      'You were signed out because your account was signed in on another device.',
    );
    return;
  }
  if ('code' in error && goneAccountCodes.has(String(error.code))) {
    await supabase.auth.signOut({ scope: 'local' });
  }
}

/** Loads the stored session and follows auth changes. Returns a cleanup. */
export function startAuthListener(): () => void {
  const { setSession } = useAuthStore.getState();
  const checkAccount = () => signOutIfAccountGone().catch(() => {});
  supabase.auth
    .getSession()
    .then(({ data }) => {
      setSession(data.session);
      setCrashUser(data.session?.user.id ?? null);
      checkAccount();
    })
    .catch(() => setSession(null));
  // Coming back to the app is when a removal elsewhere is most likely to
  // have happened.
  const appState = AppState.addEventListener('change', state => {
    if (state === 'active') {
      checkAccount();
    }
  });
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setCrashUser(session?.user.id ?? null);
    // A new sign-in (any method): sign out every other device.
    if (event === 'SIGNED_IN' && session) {
      claimSession(session.access_token).catch(() => {});
    }
    // Also covers sign-outs the app didn't start, like a revoked session.
    if (event === 'SIGNED_OUT') {
      clearQueryCache().catch(() => {});
    }
  });
  return () => {
    data.subscription.unsubscribe();
    appState.remove();
  };
}
