import { supabase } from '@/lib/supabase';
import { queryClient, queryPersister } from '@/lib/queryClient';
import { deviceTimezone } from '@/domain/timezones';
import { authRedirectFor, markProfileVerified } from './authLinks';
import { useAuthStore } from './authStore';
import { AppError, toAppError } from './errors';
import type { SignUpValues } from './schemas';

export async function signUp(values: SignUpValues): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      // Used only if "Confirm email" is on: the link signs the user in.
      emailRedirectTo: authRedirectFor('verify'),
      data: {
        full_name: values.fullName,
        phone: values.phone || null,
        default_currency: values.defaultCurrency,
        timezone: deviceTimezone(),
      },
    },
  });
  if (error) {
    throw toAppError(error);
  }
  if (!data.session) {
    // Happens if "Confirm email" is switched on in the Supabase dashboard.
    throw new AppError(
      'Account created. Confirm your email with the link or code we sent.',
      'confirmation_required',
    );
  }
}

/** Re-sends the sign-up confirmation link (only used when Confirm email is on). */
export async function resendSignUpEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectFor('verify') },
  });
  if (error) {
    throw toAppError(error);
  }
}

/**
 * Confirms a new account with the 6-digit code from the sign-up email. This
 * signs the user in (the auth listener then shows the app). Works on any
 * device, unlike the link, which needs the phone that signed up.
 */
export async function verifySignUpCode(
  email: string,
  code: string,
): Promise<void> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'signup',
  });
  if (error) {
    throw toAppError(error);
  }
  // The server marks the profile verified when the email is confirmed;
  // update the cached copy so the banner doesn't flash.
  const userId = data.user?.id;
  if (userId) {
    await markProfileVerified(userId);
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw toAppError(error);
  }
}

/** Signs out and drops every cached query so the next user starts clean. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
  queryClient.clear();
  await queryPersister.removeClient();
}

/** Emails a password-reset link and code. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectFor('reset'),
  });
  if (error) {
    throw toAppError(error);
  }
}

/**
 * Verifies the reset code (which signs the user in) and sets the new
 * password. Auth screens stay mounted until both steps finish.
 */
export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<void> {
  const { setRecovering } = useAuthStore.getState();
  setRecovering(true);
  try {
    const verified = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (verified.error) {
      throw toAppError(verified.error);
    }
    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      await supabase.auth.signOut({ scope: 'local' });
      throw toAppError(updated.error);
    }
  } finally {
    setRecovering(false);
  }
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw toAppError(error);
  }
  useAuthStore.getState().setPasswordResetPending(false);
}

/** Emails a link and one-time code that prove the user owns their address. */
export async function sendVerificationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: authRedirectFor('verify'),
    },
  });
  if (error) {
    throw toAppError(error);
  }
}

/**
 * Verifies the emailed code. That issues a session whose JWT records the
 * one-time code, which mark_email_verified() requires server-side.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<void> {
  const verified = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
  });
  if (verified.error) {
    throw toAppError(verified.error);
  }
  const { error } = await supabase.rpc('mark_email_verified');
  if (error) {
    throw toAppError(error);
  }
  const userId = verified.data.user?.id;
  if (userId) {
    await markProfileVerified(userId);
  }
}

/** Removes the avatar, deletes the account server-side, then signs out. */
export async function deleteAccount(userId: string): Promise<void> {
  await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
  const { error } = await supabase.rpc('delete_account');
  if (error) {
    throw toAppError(error);
  }
  await signOut();
}
