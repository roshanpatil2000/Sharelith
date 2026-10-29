import { AppError, toAppError } from '../errors';

describe('toAppError', () => {
  it('maps known Supabase auth codes', () => {
    expect(toAppError({ code: 'invalid_credentials' }).message).toBe(
      'Wrong email or password.',
    );
    expect(toAppError({ code: 'user_already_exists' }).message).toMatch(
      /already exists/,
    );
    expect(toAppError({ code: 'otp_expired' }).message).toMatch(/expired/);
  });

  it('detects network failures', () => {
    const err = toAppError({
      name: 'AuthRetryableFetchError',
      message: 'Network request failed',
      status: 0,
    });
    expect(err.code).toBe('network');
    expect(err.message).toMatch(/Can’t reach the server/);
  });

  it('does not blame the network for server errors', () => {
    // supabase-js uses the same error class for 5xx responses.
    const emailFailure = toAppError({
      name: 'AuthRetryableFetchError',
      message: 'Error sending confirmation email',
      status: 500,
    });
    expect(emailFailure.code).toBe('email_send_failed');
    expect(emailFailure.message).toMatch(/couldn’t send the email/);

    const gateway = toAppError({
      name: 'AuthRetryableFetchError',
      message: 'Gateway Timeout',
      status: 504,
    });
    expect(gateway.code).toBe('server');
  });

  it('detects rate limits from the message', () => {
    expect(toAppError({ message: 'Email rate limit exceeded' }).code).toBe(
      'rate_limit',
    );
  });

  it('maps the server-side verification guard', () => {
    expect(
      toAppError({ message: 'Email must be verified with a one-time code' })
        .message,
    ).toMatch(/verify your email/);
  });

  it('falls back to a generic message and passes AppErrors through', () => {
    expect(toAppError(new Error('boom')).message).toBe(
      'Something went wrong. Please try again.',
    );
    const original = new AppError('Custom', 'x');
    expect(toAppError(original)).toBe(original);
    expect(toAppError(undefined)).toBeInstanceOf(AppError);
  });
});
