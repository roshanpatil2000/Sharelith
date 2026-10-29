import { waitFor } from '@testing-library/react-native';
import { useToastStore } from '@/components';
import {
  emitAuth,
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';
import { queryClient } from '@/lib/queryClient';
import { profileKey, type Profile } from '@/features/account/api';
import { authRedirectFor, handleAuthLink, parseAuthLink } from '../authLinks';
import { selectStatus, startAuthListener, useAuthStore } from '../authStore';

describe('parseAuthLink', () => {
  it('reads the code and intent', () => {
    expect(
      parseAuthLink('sharelith://auth/callback?next=verify&code=abc-123'),
    ).toEqual({ kind: 'code', code: 'abc-123', intent: 'verify' });
    expect(
      parseAuthLink('sharelith://auth/callback/?code=x&next=reset'),
    ).toEqual({ kind: 'code', code: 'x', intent: 'reset' });
  });

  it('ignores unknown intents and non-auth URLs', () => {
    expect(parseAuthLink('sharelith://auth/callback?code=x&next=evil')).toEqual(
      { kind: 'code', code: 'x', intent: null },
    );
    expect(parseAuthLink('sharelith://groups/1')).toBeNull();
    expect(
      parseAuthLink('https://evil.example/auth/callback?code=x'),
    ).toBeNull();
    expect(parseAuthLink('sharelith://auth/callback')).toBeNull();
  });

  it('reads Supabase errors from the query or fragment', () => {
    expect(
      parseAuthLink(
        'sharelith://auth/callback?next=verify#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid',
    });
  });
});

describe('authRedirectFor', () => {
  it('points at the bridge page with the intent', () => {
    expect(authRedirectFor('verify')).toBe(
      'https://sharelith.techbeas.co.in/auth/callback?next=verify',
    );
  });
});

describe('handleAuthLink', () => {
  const lastToast = () => useToastStore.getState().message;

  it('verify: exchanges the code then marks the email verified', async () => {
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: fakeSession().user, session: fakeSession() },
      error: null,
    });
    await handleAuthLink('sharelith://auth/callback?next=verify&code=abc');
    expect(supabaseMock.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      'abc',
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith('mark_email_verified');
    expect(lastToast()).toBe('Email confirmed');
  });

  it('verify: fixes a profile cached before the server marked it', async () => {
    // A fetch that raced the RPC cached the old, unverified profile.
    queryClient.setQueryData(profileKey('user-1'), fakeProfile());
    supabaseMock.from.mockReturnValue(
      queryBuilder({
        data: fakeProfile({ email_verified_at: '2026-10-29T05:20:09Z' }),
        error: null,
      }),
    );
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: fakeSession().user, session: fakeSession() },
      error: null,
    });
    await handleAuthLink('sharelith://auth/callback?next=verify&code=abc');
    const cached = queryClient.getQueryData<Profile>(profileKey('user-1'));
    expect(cached?.email_verified_at).toBeTruthy();
  });

  it('reset: signs in and requires a new password first', async () => {
    const stop = startAuthListener();
    await waitFor(() =>
      expect(selectStatus(useAuthStore.getState())).toBe('signedOut'),
    );
    supabaseMock.auth.exchangeCodeForSession.mockImplementationOnce(
      async () => {
        emitAuth('SIGNED_IN', fakeSession());
        return {
          data: { user: fakeSession().user, session: fakeSession() },
          error: null,
        };
      },
    );
    await handleAuthLink('sharelith://auth/callback?next=reset&code=abc');
    const s = useAuthStore.getState();
    expect(selectStatus(s)).toBe('signedIn');
    expect(s.passwordResetPending).toBe(true);
    // A reset link also proves the address.
    expect(supabaseMock.rpc).toHaveBeenCalledWith('mark_email_verified');
    stop();
  });

  it('explains a failed exchange (wrong device / reused link)', async () => {
    supabaseMock.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'invalid flow state' },
    });
    await handleAuthLink('sharelith://auth/callback?next=verify&code=abc');
    expect(lastToast()).toMatch(/Open the link on the phone/);
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('reports expired links without calling Supabase', async () => {
    await handleAuthLink(
      'sharelith://auth/callback?error=access_denied&error_code=otp_expired',
    );
    expect(lastToast()).toBe('That link has expired. Request a new one.');
    expect(supabaseMock.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
