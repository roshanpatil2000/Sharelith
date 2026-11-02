import { waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useToastStore } from '@/components';
import {
  emitAuth,
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';
import { queryClient } from '@/lib/queryClient';
import { profileKey, type Profile } from '@/features/account/api';
import {
  authRedirectFor,
  emailFromToken,
  handleAuthLink,
  parseAuthLink,
} from '../authLinks';
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

describe('parseAuthLink: invites', () => {
  it('reads implicit-flow tokens from the fragment', () => {
    expect(
      parseAuthLink(
        'sharelith://auth/callback?next=invite#access_token=at&refresh_token=rt&type=invite',
      ),
    ).toEqual({
      kind: 'tokens',
      accessToken: 'at',
      refreshToken: 'rt',
      intent: 'invite',
    });
  });

  it('falls back to the type parameter for the intent', () => {
    const link = parseAuthLink(
      'sharelith://auth/callback#access_token=at&refresh_token=rt&type=invite',
    );
    expect(link).toMatchObject({ kind: 'tokens', intent: 'invite' });
  });
});

/** An unsigned JWT: the app only reads the email to show it. */
const inviteToken = (email: string) =>
  `h.${btoa(JSON.stringify({ email })).replace(/[=]+$/, '')}.s`;

/** Answers the sign-in prompt by pressing the named button. */
const answerPrompt = (button: 'Continue' | 'Cancel') =>
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_title, _message, buttons) =>
      buttons?.find(b => b.text === button)?.onPress?.(),
    );

describe('handleAuthLink: invite', () => {
  const at = inviteToken('asha@example.com');

  it('reads the email from a token, and rejects junk', () => {
    expect(emailFromToken(at)).toBe('asha@example.com');
    expect(emailFromToken('junk')).toBeNull();
  });

  it('does nothing if the person cancels the prompt', async () => {
    const alert = answerPrompt('Cancel');
    supabaseMock.auth.setSession = jest.fn() as never;
    await handleAuthLink(
      `sharelith://auth/callback?next=invite#access_token=${at}&refresh_token=rt`,
    );
    expect(alert.mock.calls[0]?.[1]).toContain('asha@example.com');
    expect(supabaseMock.auth.setSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().passwordResetPending).toBe(false);
  });

  it('warns that the current account will be signed out', async () => {
    useAuthStore.setState({ session: fakeSession() });
    const alert = answerPrompt('Cancel');
    await handleAuthLink(
      `sharelith://auth/callback?next=invite#access_token=${at}&refresh_token=rt`,
    );
    expect(alert.mock.calls[0]?.[1]).toContain('signed out');
  });

  it.each([
    ['tokens without an invite', `next=verify#access_token=${at}`],
    ['an unreadable token', 'next=invite#access_token=junk'],
  ])('refuses %s without prompting', async (_name, query) => {
    const alert = answerPrompt('Continue');
    supabaseMock.auth.setSession = jest.fn() as never;
    await handleAuthLink(`sharelith://auth/callback?${query}&refresh_token=rt`);
    expect(alert).not.toHaveBeenCalled();
    expect(supabaseMock.auth.setSession).not.toHaveBeenCalled();
  });

  it('signs in with the tokens and requires a password first', async () => {
    answerPrompt('Continue');
    supabaseMock.auth.setSession = jest.fn(async () => ({
      data: { user: fakeSession().user, session: fakeSession() },
      error: null,
    })) as never;
    await handleAuthLink(
      `sharelith://auth/callback?next=invite#access_token=${at}&refresh_token=rt`,
    );
    expect(supabaseMock.auth.setSession).toHaveBeenCalledWith({
      access_token: at,
      refresh_token: 'rt',
    });
    expect(useAuthStore.getState().passwordResetPending).toBe('invite');
  });

  it('clears the pending state if the tokens are rejected', async () => {
    answerPrompt('Continue');
    supabaseMock.auth.setSession = jest.fn(async () => ({
      data: { user: null, session: null },
      error: { message: 'invalid' },
    })) as never;
    await handleAuthLink(
      `sharelith://auth/callback?next=invite#access_token=${at}&refresh_token=y`,
    );
    expect(useAuthStore.getState().passwordResetPending).toBe(false);
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
    mockProfiles(
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
    expect(s.passwordResetPending).toBe('reset');
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
