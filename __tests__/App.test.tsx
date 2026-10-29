import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  emitAuth,
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

beforeEach(() => {
  supabaseMock.from.mockReturnValue(
    queryBuilder({ data: fakeProfile(), error: null }),
  );
});

describe('App auth flow', () => {
  it('logs in from Welcome and lands on the tabs', async () => {
    supabaseMock.auth.signInWithPassword.mockImplementationOnce(async () => {
      emitAuth('SIGNED_IN', fakeSession());
      return { data: {}, error: null };
    });

    await render(<App />);
    await fireEvent.press(await screen.findByTestId('welcome-login'));
    await fireEvent.changeText(
      await screen.findByTestId('login-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('login-password'),
      'secret-pass',
    );
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'secret-pass',
    });
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    // Unverified profile → nudge banner.
    expect(
      await screen.findByText('Confirm your email so friends can find you.'),
    ).toBeOnTheScreen();
  });

  it('shows a friendly error for wrong credentials', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: 'invalid_credentials', message: 'Invalid login' },
    });

    await render(<App />);
    await fireEvent.press(await screen.findByTestId('welcome-login'));
    await fireEvent.changeText(
      await screen.findByTestId('login-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(screen.getByTestId('login-password'), 'wrong');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(
      await screen.findByText('Wrong email or password.'),
    ).toBeOnTheScreen();
  });

  it('signs up with the form values as profile metadata', async () => {
    supabaseMock.auth.signUp.mockImplementationOnce(async () => {
      emitAuth('SIGNED_IN', fakeSession());
      return { data: { session: fakeSession() }, error: null };
    });

    await render(<App />);
    await fireEvent.press(await screen.findByTestId('welcome-signup'));
    await fireEvent.changeText(
      await screen.findByTestId('signup-name'),
      'Asha Rao',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-password'),
      'correct-horse',
    );
    await fireEvent.press(screen.getByTestId('signup-currency-option-USD'));
    await fireEvent.press(screen.getByTestId('signup-submit'));

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      password: 'correct-horse',
      options: {
        emailRedirectTo:
          'https://sharelith.techbeas.co.in/auth/callback?next=verify',
        data: expect.objectContaining({
          full_name: 'Asha Rao',
          phone: null,
          default_currency: 'USD',
        }),
      },
    });
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    // Wait for the profile to load (it drives the verify banner) so no
    // update lands after the test ends.
    expect(
      await screen.findByText('Confirm your email so friends can find you.'),
    ).toBeOnTheScreen();
  });

  it('goes to Check your email when Confirm email is on', async () => {
    // No session: Supabase wants the email confirmed first.
    supabaseMock.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: fakeSession().user },
      error: null,
    });

    await render(<App />);
    await fireEvent.press(await screen.findByTestId('welcome-signup'));
    await fireEvent.changeText(
      await screen.findByTestId('signup-name'),
      'Asha Rao',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-password'),
      'correct-horse',
    );
    await fireEvent.press(screen.getByTestId('signup-submit'));

    expect(await screen.findByText('Check your email')).toBeOnTheScreen();
    expect(screen.getByText('asha@example.com')).toBeOnTheScreen();
    // Resend waits for the cooldown, so it's disabled straight away.
    expect(screen.getByTestId('check-email-resend')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('check-email-login'));
    expect(await screen.findByTestId('login-email')).toHaveDisplayValue(
      'asha@example.com',
    );
  });

  it('shows the profile on the Account tab and logs out', async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: fakeSession() },
      error: null,
    });
    supabaseMock.from.mockReturnValue(
      queryBuilder({
        data: fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' }),
        error: null,
      }),
    );

    await render(<App />);
    await fireEvent.press(
      await screen.findByRole('button', { name: /Account/ }),
    );
    expect(await screen.findByText('Asha Rao')).toBeOnTheScreen();
    expect(
      screen.queryByText('Confirm your email so friends can find you.'),
    ).toBeNull();

    await fireEvent.press(screen.getByTestId('account-logout'));
    // The row and the dialog's confirm button share the label; confirm is last.
    const logOutButtons = screen.getAllByRole('button', { name: 'Log out' });
    await fireEvent.press(logOutButtons[logOutButtons.length - 1]!);
    expect(await screen.findByTestId('welcome-login')).toBeOnTheScreen();
  });
});
