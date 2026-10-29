// Negative paths: invalid input must never reach Supabase, and server errors
// must surface as friendly messages.
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  emitAuth,
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

beforeEach(() => {
  mockProfiles(queryBuilder({ data: fakeProfile(), error: null }));
});

async function openSignUp() {
  await render(<App />);
  await fireEvent.press(await screen.findByTestId('welcome-signup'));
  await screen.findByTestId('signup-name');
}

async function openLogIn() {
  await render(<App />);
  await fireEvent.press(await screen.findByTestId('welcome-login'));
  await screen.findByTestId('login-email');
}

async function signedInAt(path: 'EditProfile') {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: /Account/ }));
  if (path === 'EditProfile') {
    await fireEvent.press(await screen.findByTestId('account-edit-profile'));
    await screen.findByTestId('edit-name');
  }
}

describe('Sign up: invalid input never reaches Supabase', () => {
  it('empty form shows every required error', async () => {
    await openSignUp();
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByText('Enter your name')).toBeOnTheScreen();
    expect(screen.getByText('Enter your email')).toBeOnTheScreen();
    expect(screen.getByText('Use at least 8 characters')).toBeOnTheScreen();
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it.each([
    ['signup-email', 'not-an-email', 'Enter a valid email address'],
    ['signup-email', 'a@b', 'Enter a valid email address'],
    ['signup-password', '1234567', 'Use at least 8 characters'],
    ['signup-password', 'x'.repeat(73), 'Use at most 72 characters'],
    ['signup-phone', 'call me', 'Enter a valid phone number'],
    ['signup-phone', '123', 'Enter a valid phone number'],
  ])('%s = %p → "%s"', async (field, value, message) => {
    await openSignUp();
    await fireEvent.changeText(screen.getByTestId('signup-name'), 'Asha');
    await fireEvent.changeText(
      screen.getByTestId('signup-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-password'),
      'correct-horse',
    );
    await fireEvent.changeText(screen.getByTestId(field), value);
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it('whitespace-only name is rejected', async () => {
    await openSignUp();
    await fireEvent.changeText(screen.getByTestId('signup-name'), '   ');
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByText('Enter your name')).toBeOnTheScreen();
  });

  it('existing email shows a friendly message', async () => {
    supabaseMock.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: {
        code: 'user_already_exists',
        message: 'User already registered',
      },
    });
    await openSignUp();
    await fireEvent.changeText(screen.getByTestId('signup-name'), 'Asha');
    await fireEvent.changeText(
      screen.getByTestId('signup-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-password'),
      'correct-horse',
    );
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(
      await screen.findByText(
        /already exists\. Log in, or if a friend invited you/,
      ),
    ).toBeOnTheScreen();
  });
});

describe('Log in: bad input and server errors', () => {
  it('empty form never calls Supabase', async () => {
    await openLogIn();
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText('Enter your email')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    [
      {
        name: 'AuthRetryableFetchError',
        status: 0,
        message: 'Network request failed',
      },
      /Can’t reach the server/,
    ],
    [{ code: 'over_request_rate_limit', status: 429 }, /Too many attempts/],
    [{ code: 'email_not_confirmed', status: 400 }, /confirm your email/],
    [{ status: 503, message: 'Service Unavailable' }, /server had a problem/],
  ])('%o → friendly message', async (error, message) => {
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error,
    });
    await openLogIn();
    await fireEvent.changeText(
      screen.getByTestId('login-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(screen.getByTestId('login-password'), 'pw');
    await fireEvent.press(screen.getByTestId('login-submit'));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    // Still on the login screen.
    expect(screen.getByTestId('login-email')).toBeOnTheScreen();
  });
});

describe('Edit profile: invalid input never reaches Supabase', () => {
  it('blank name is rejected and nothing is saved', async () => {
    await signedInAt('EditProfile');
    const builder = queryBuilder({ data: fakeProfile(), error: null });
    mockProfiles(builder);
    await fireEvent.changeText(screen.getByTestId('edit-name'), '  ');
    await fireEvent.press(screen.getByTestId('edit-save'));
    expect(await screen.findByText('Enter your name')).toBeOnTheScreen();
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('invalid phone is rejected', async () => {
    await signedInAt('EditProfile');
    await fireEvent.changeText(screen.getByTestId('edit-phone'), 'abc');
    await fireEvent.press(screen.getByTestId('edit-save'));
    expect(
      await screen.findByText('Enter a valid phone number'),
    ).toBeOnTheScreen();
  });

  it('a server rejection is shown, not swallowed', async () => {
    await signedInAt('EditProfile');
    mockProfiles(
      queryBuilder({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      }),
    );
    await fireEvent.changeText(screen.getByTestId('edit-name'), 'New Name');
    await fireEvent.press(screen.getByTestId('edit-save'));
    expect(
      await screen.findByText('Something went wrong. Please try again.'),
    ).toBeOnTheScreen();
    // Stayed on the edit screen so the user can retry.
    expect(screen.getByTestId('edit-save')).toBeOnTheScreen();
  });
});

describe('Check your email: confirm with the code', () => {
  async function reachCheckEmail() {
    supabaseMock.auth.signUp.mockResolvedValueOnce({
      data: { session: null, user: fakeSession().user },
      error: null,
    });
    await openSignUp();
    await fireEvent.changeText(screen.getByTestId('signup-name'), 'Asha');
    await fireEvent.changeText(
      screen.getByTestId('signup-email'),
      'asha@example.com',
    );
    await fireEvent.changeText(
      screen.getByTestId('signup-password'),
      'correct-horse',
    );
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('check-email-code');
  }

  it('a bad-format code never reaches Supabase', async () => {
    await reachCheckEmail();
    await fireEvent.changeText(screen.getByTestId('check-email-code'), '12ab');
    await fireEvent.press(screen.getByTestId('check-email-submit'));
    expect(
      await screen.findByText('Enter the code from the email'),
    ).toBeOnTheScreen();
    expect(supabaseMock.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('a wrong or expired code shows a friendly error', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        code: 'otp_expired',
        message: 'Token has expired or is invalid',
      },
    });
    await reachCheckEmail();
    await fireEvent.changeText(
      screen.getByTestId('check-email-code'),
      '000000',
    );
    await fireEvent.press(screen.getByTestId('check-email-submit'));
    expect(await screen.findByText(/expired or is wrong/)).toBeOnTheScreen();
    expect(screen.getByTestId('check-email-code')).toBeOnTheScreen();
  });

  it('the right code confirms the account and opens the app', async () => {
    supabaseMock.auth.verifyOtp.mockImplementationOnce(async () => {
      emitAuth('SIGNED_IN', fakeSession());
      return {
        data: { user: fakeSession().user, session: fakeSession() },
        error: null,
      };
    });
    await reachCheckEmail();
    await fireEvent.changeText(
      screen.getByTestId('check-email-code'),
      '123456',
    );
    await fireEvent.press(screen.getByTestId('check-email-submit'));
    expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'asha@example.com',
      token: '123456',
      type: 'signup',
    });
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
  });
});
