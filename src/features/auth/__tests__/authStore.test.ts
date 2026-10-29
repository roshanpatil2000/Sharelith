import { waitFor } from '@testing-library/react-native';
import { emitAuth, fakeSession, supabaseMock } from '@/test/supabaseMock';
import { selectStatus, startAuthListener, useAuthStore } from '../authStore';
import { resetPassword } from '../api';

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
