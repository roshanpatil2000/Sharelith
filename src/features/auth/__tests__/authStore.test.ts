import { AppState } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import { emitAuth, fakeSession, supabaseMock } from '@/test/supabaseMock';
import { queryClient } from '@/lib/queryClient';
import { selectStatus, startAuthListener, useAuthStore } from '../authStore';
import { resetPassword } from '../api';
import { AuthSessionMissingError } from '@supabase/supabase-js';
import { toast } from '@/components/feedback/Toast';

const status = () => selectStatus(useAuthStore.getState());

describe('authStore', () => {
  it('is loading until the stored session is read', async () => {
    expect(status()).toBe('loading');
    const stop = startAuthListener();
    await waitFor(() => expect(status()).toBe('signedOut'));
    stop();
  });

  it('restores a stored session as signed in', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: fakeSession() },
      error: null,
    });
    const stop = startAuthListener();
    await waitFor(() => expect(status()).toBe('signedIn'));
    stop();
  });

  describe('when the account behind a saved session is gone', () => {
    const restore = () => {
      supabaseMock.auth.getSession.mockResolvedValueOnce({
        data: { session: fakeSession() },
        error: null,
      });
    };
    const answer = (error: unknown) =>
      supabaseMock.auth.getUser.mockResolvedValueOnce({
        data: { user: null as never },
        error,
      });

    it('signs out on launch when the account was deleted', async () => {
      restore();
      answer({ name: 'AuthApiError', status: 403, code: 'user_not_found' });
      const stop = startAuthListener();
      await waitFor(() =>
        expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({
          scope: 'local',
        }),
      );
      expect(status()).toBe('signedOut');
      stop();
    });

    it('signs out when the session was revoked', async () => {
      restore();
      answer({ name: 'AuthApiError', status: 403, code: 'session_not_found' });
      const stop = startAuthListener();
      await waitFor(() => expect(status()).toBe('signedOut'));
      stop();
    });

    it('explains when another device signed in and ended this session', async () => {
      const show = jest.spyOn(toast, 'show');
      restore();
      // What supabase-js returns when the server says the session is gone.
      answer(new AuthSessionMissingError());
      const stop = startAuthListener();
      await waitFor(() => expect(status()).toBe('signedOut'));
      expect(show).toHaveBeenCalledWith(
        expect.stringMatching(/signed in on another device/),
      );
      stop();
    });

    it('stays signed in when the check fails for another reason', async () => {
      restore();
      // No network: the account may well still exist.
      answer({ name: 'AuthRetryableFetchError', status: 0 });
      const stop = startAuthListener();
      await waitFor(() => expect(status()).toBe('signedIn'));
      await waitFor(() => expect(supabaseMock.auth.getUser).toHaveBeenCalled());
      expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
      expect(status()).toBe('signedIn');
      stop();
    });

    it('checks again when the app comes back to the foreground', async () => {
      const addListener = AppState.addEventListener as jest.Mock;
      restore();
      const stop = startAuthListener();
      await waitFor(() => expect(status()).toBe('signedIn'));
      expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();

      // Deleted from another device while this one was in the background.
      answer({ name: 'AuthApiError', status: 403, code: 'user_not_found' });
      addListener.mock.calls
        .filter(([type]) => type === 'change')
        .forEach(([, listener]) => listener('active'));
      await waitFor(() => expect(status()).toBe('signedOut'));
      stop();
    });
  });

  it('follows auth state changes', async () => {
    const stop = startAuthListener();
    await waitFor(() => expect(status()).toBe('signedOut'));
    emitAuth('SIGNED_IN', fakeSession());
    expect(status()).toBe('signedIn');
    emitAuth('SIGNED_OUT', null);
    expect(status()).toBe('signedOut');
    stop();
  });

  it('stays signed out while a password reset is in progress', async () => {
    const stop = startAuthListener();
    await waitFor(() => expect(status()).toBe('signedOut'));

    let statusDuringUpdate: string | undefined;
    supabaseMock.auth.verifyOtp.mockImplementationOnce(async () => {
      // The reset code signs the user in before the password is saved.
      emitAuth('SIGNED_IN', fakeSession());
      return { data: { user: fakeSession().user }, error: null };
    });
    supabaseMock.auth.updateUser.mockImplementationOnce(async () => {
      statusDuringUpdate = status();
      return { data: {}, error: null };
    });

    await resetPassword('asha@example.com', '123456', 'new-password');
    expect(statusDuringUpdate).toBe('signedOut');
    expect(status()).toBe('signedIn');
    stop();
  });

  it('signs back out if saving the new password fails', async () => {
    const stop = startAuthListener();
    await waitFor(() => expect(status()).toBe('signedOut'));
    supabaseMock.auth.verifyOtp.mockImplementationOnce(async () => {
      emitAuth('SIGNED_IN', fakeSession());
      return { data: { user: fakeSession().user }, error: null };
    });
    supabaseMock.auth.updateUser.mockResolvedValueOnce({
      data: {},
      error: { code: 'same_password' },
    } as never);

    await expect(
      resetPassword('asha@example.com', '123456', 'old-password'),
    ).rejects.toThrow(/must be different/);
    expect(status()).toBe('signedOut');
    stop();
  });
});

describe('startAuthListener', () => {
  it('clears the cache on a sign-out the app did not start', async () => {
    const stop = startAuthListener();
    queryClient.setQueryData(['friends', 'user-1'], [{ id: 'x' }]);
    emitAuth('SIGNED_OUT', null);
    expect(queryClient.getQueryData(['friends', 'user-1'])).toBeUndefined();
    stop();
  });

  it('keeps the cache on other auth events', () => {
    const stop = startAuthListener();
    queryClient.setQueryData(['friends', 'user-1'], [{ id: 'x' }]);
    emitAuth('TOKEN_REFRESHED', fakeSession());
    expect(queryClient.getQueryData(['friends', 'user-1'])).toHaveLength(1);
    stop();
  });
});
