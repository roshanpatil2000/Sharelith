import React from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { queryClient } from '@/lib/queryClient';
import { useSettingsStore } from '@/lib/settingsStore';
import { storage } from '@/lib/storage';
import { useAuthStore } from '@/features/auth/authStore';
import { authenticate } from '@/features/lock/biometrics';
import {
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

jest.mock('@/features/lock/biometrics', () => ({
  ...jest.requireActual('@/features/lock/biometrics'),
  authenticate: jest.fn(async () => true),
}));

const signedIn = async () => {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  mockProfiles(
    queryBuilder({
      data: fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' }),
      error: null,
    }),
  );
  await render(<App />);
};

const openAccount = async () => {
  await signedIn();
  await fireEvent.press(await screen.findByRole('button', { name: /Account/ }));
};

afterEach(() => {
  useSettingsStore.setState({ appLockEnabled: false });
  (authenticate as jest.Mock).mockResolvedValue(true);
});

describe('Account header', () => {
  it('keeps showing the error while a failed profile reloads', async () => {
    queryClient.setQueryDefaults(['profile'], { retry: false });
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: fakeSession() },
      error: null,
    });
    mockProfiles(queryBuilder({ data: null, error: { message: 'boom' } }));
    await render(<App />);
    await fireEvent.press(
      await screen.findByRole('button', { name: /Account/ }),
    );
    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();

    // Holds the retry open, to check what shows during a reload.
    type Result = { data: unknown; error: unknown };
    let finish = (_result: Result) => {};
    const failed = supabaseMock.rpc.getMockImplementation();
    supabaseMock.rpc.mockImplementation(
      () => new Promise<Result>(resolve => (finish = resolve)),
    );
    await act(async () => {
      queryClient.refetchQueries({ queryKey: ['profile'] });
      // Query updates reach the screen on a timer.
      await new Promise<void>(resolve => setTimeout(() => resolve(), 20));
    });
    expect(screen.getByText('Something went wrong')).toBeOnTheScreen();

    await act(async () => finish({ data: null, error: { message: 'boom' } }));
    supabaseMock.rpc.mockImplementation(failed!);
    queryClient.setQueryDefaults(['profile'], { retry: undefined });
  });
});

describe('Change password', () => {
  const fill = async (current: string) => {
    await openAccount();
    await fireEvent.press(await screen.findByText('Change password'));
    await fireEvent.changeText(
      await screen.findByTestId('password-current'),
      current,
    );
    await fireEvent.changeText(
      screen.getByTestId('password-new'),
      'new-secret-1',
    );
    await fireEvent.changeText(
      screen.getByTestId('password-confirm'),
      'new-secret-1',
    );
    await fireEvent.press(screen.getByTestId('password-submit'));
  };

  it('needs the current password', async () => {
    await fill('');
    expect(
      await screen.findByText('Enter your current password'),
    ).toBeOnTheScreen();
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('changes nothing if the current password is wrong', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });
    await fill('wrong');
    expect(await screen.findByText('That password isn’t right.')).toBeTruthy();
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
  });

  it('changes it once the current password checks out', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    await fill('right');
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'right',
    });
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({
      password: 'new-secret-1',
    });
  });
});

describe('Delete account', () => {
  const submit = async () => {
    await openAccount();
    await fireEvent.press(await screen.findByTestId('account-delete'));
    await fireEvent.changeText(
      await screen.findByTestId('delete-password'),
      'secret',
    );
    await fireEvent.press(screen.getByTestId('delete-submit'));
  };

  it('deletes nothing if the password is wrong', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });
    await submit();
    expect(await screen.findByText('That password isn’t right.')).toBeTruthy();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_account');
  });

  const owing = (balances: unknown[]) =>
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'list_my_balances'
        ? { data: balances, error: null }
        : { data: null, error: null },
    );
  const unsettled = [
    { friend_id: 'f-asha', group_id: null, currency: 'INR', net_minor: -500 },
  ];
  // This file doesn't reset mocks between tests; leave RPCs as they were.
  afterEach(() => owing([]));

  it('asks you to settle up first while anything is owed', async () => {
    owing(unsettled);
    await openAccount();
    await fireEvent.press(await screen.findByTestId('account-delete'));
    expect(
      await screen.findByText(/You still owe or are owed money/),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  it('keeps everything, avatar included, if a balance appears meanwhile', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    owing([]);
    await openAccount();
    await fireEvent.press(await screen.findByTestId('account-delete'));
    await fireEvent.changeText(
      await screen.findByTestId('delete-password'),
      'secret',
    );
    // Settled when the screen opened, but not by the time of submitting.
    owing(unsettled);
    await fireEvent.press(screen.getByTestId('delete-submit'));
    expect(
      await screen.findByText(
        'Settle up with everyone before deleting your account',
      ),
    ).toBeOnTheScreen();
    expect(supabaseMock.storage.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_account');
  });

  it('deletes the account once the password checks out', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({ error: null });
    await submit();
    expect(await screen.findByTestId('welcome-login')).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_account');
  });
});

describe('App lock', () => {
  it('can be escaped by logging out when unlocking fails', async () => {
    (authenticate as jest.Mock).mockResolvedValue(false);
    useSettingsStore.setState({ appLockEnabled: true });
    await signedIn();
    await fireEvent.press(await screen.findByTestId('app-lock-logout'));
    expect(await screen.findByTestId('welcome-login')).toBeOnTheScreen();
    expect(screen.queryByTestId('app-lock')).toBeNull();
  });

  it('covers the app while it is not active', async () => {
    const listeners: ((state: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener');
    spy.mockImplementation(((
      _type: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: () => {} };
    }) as never);
    await signedIn();
    await screen.findByText('No groups yet');
    useSettingsStore.setState({ appLockEnabled: true });
    const send = (state: string) =>
      act(async () => listeners.forEach(listener => listener(state)));
    await send('inactive');
    expect(screen.getByTestId('app-privacy-cover')).toBeOnTheScreen();
    await send('active');
    expect(screen.queryByTestId('app-privacy-cover')).toBeNull();
    spy.mockRestore();
  });
});

describe('Pending password', () => {
  it('is saved so closing the app can’t skip it', () => {
    useAuthStore.getState().setPasswordResetPending('invite');
    expect(storage.getString('auth-flow')).toContain('invite');
    useAuthStore.getState().setPasswordResetPending(false);
  });
});
