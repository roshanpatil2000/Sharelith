import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

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
   * choose a new password before using the app.
   */
  passwordResetPending: false | 'reset' | 'invite';
  setSession: (session: Session | null) => void;
  setRecovering: (recovering: boolean) => void;
  setPasswordResetPending: (pending: false | 'reset' | 'invite') => void;
};

export const useAuthStore = create<AuthState>(set => ({
  session: null,
  ready: false,
  recovering: false,
  passwordResetPending: false,
  setSession: session =>
    set(s => ({
      session,
      ready: true,
      passwordResetPending: session ? s.passwordResetPending : false,
    })),
  setRecovering: recovering => set({ recovering }),
  setPasswordResetPending: passwordResetPending =>
    set({ passwordResetPending }),
}));

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

/** Loads the stored session and follows auth changes. Returns a cleanup. */
export function startAuthListener(): () => void {
  const { setSession } = useAuthStore.getState();
  supabase.auth
    .getSession()
    .then(({ data }) => setSession(data.session))
    .catch(() => setSession(null));
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });
  return () => data.subscription.unsubscribe();
}
