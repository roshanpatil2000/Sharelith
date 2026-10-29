/** Error with a message safe to show to the user. */
export class AppError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'AppError';
  }
}

const byCode: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  user_already_exists:
    'An account with this email already exists. Try logging in.',
  email_exists: 'An account with this email already exists. Try logging in.',
  weak_password: 'Choose a stronger password (at least 8 characters).',
  same_password: 'Your new password must be different from the old one.',
  email_address_invalid: 'That email address doesn’t look right.',
  otp_expired: 'That code has expired or is wrong. Request a new one.',
  over_email_send_rate_limit:
    'Too many emails sent. Please wait a few minutes and try again.',
  over_request_rate_limit:
    'Too many attempts. Please wait a minute and try again.',
  email_not_confirmed: 'Please confirm your email address first.',
  user_not_found: 'No account found for that email.',
  signup_disabled: 'Sign-ups are currently disabled.',
};

type MaybeSupabaseError = {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
};

/** Converts Supabase/network errors into an AppError with friendly text. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const e = (error ?? {}) as MaybeSupabaseError;
  if (__DEV__) {
    // Friendly text hides the cause; keep the raw error visible in dev.
    console.warn('[auth]', e.name, e.status, e.code, e.message);
  }
  if (e.code && byCode[e.code]) {
    return new AppError(byCode[e.code]!, e.code);
  }
  const message = e.message ?? '';
  // supabase-js reports both "no network" (status 0) and 5xx responses as
  // AuthRetryableFetchError, so the status decides which message fits.
  if (
    e.status === 0 ||
    /network request failed|failed to fetch/i.test(message)
  ) {
    return new AppError(
      'Can’t reach the server. Check your connection and try again.',
      'network',
    );
  }
  if (/sending .*email|smtp/i.test(message)) {
    return new AppError(
      'We couldn’t send the email right now. Please try again in a few minutes.',
      'email_send_failed',
    );
  }
  if (e.status !== undefined && e.status >= 500) {
    return new AppError(
      'The server had a problem. Please try again in a moment.',
      'server',
    );
  }
  if (/rate limit/i.test(message)) {
    return new AppError(byCode.over_request_rate_limit!, 'rate_limit');
  }
  if (/one-time code/i.test(message)) {
    return new AppError('Please verify your email with the code we sent.');
  }
  return new AppError('Something went wrong. Please try again.', e.code);
}
