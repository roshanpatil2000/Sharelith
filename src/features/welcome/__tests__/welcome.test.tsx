import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../../../../App';
import {
  emitAuth,
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';
import { useInviteStore } from '@/features/invites/links';
import { useAuthStore } from '@/features/auth/authStore';

beforeEach(() => {
  mockProfiles(queryBuilder({ data: fakeProfile(), error: null }));
});

async function logIn() {
  await render(<App />);
  await screen.findByTestId('welcome-login');
  await act(async () => emitAuth('SIGNED_IN', fakeSession()));
  await screen.findByTestId('welcome-tour');
}

async function reopenSignedIn() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
}

describe('welcome pages', () => {
  it('greets by first name and goes to the app after the last page', async () => {
    await logIn();
    expect(await screen.findByText('Good to have you, Asha')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('tour-next'));
    expect(screen.getByLabelText('Page 2 of 3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('tour-next'));
    expect(screen.getByText('Get started')).toBeOnTheScreen();
    expect(screen.queryByTestId('tour-skip')).toBeNull();
    await fireEvent.press(screen.getByTestId('tour-next'));
    await fireEvent.press(await screen.findByTestId('setup-skip'));
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    expect(useAuthStore.getState().welcomePending).toBe(false);
  });

  it('follows a swipe', async () => {
    await logIn();
    await fireEvent.scroll(screen.getByTestId('tour-pager'), {
      nativeEvent: {
        contentOffset: { x: 10000, y: 0 },
        contentSize: { width: 11250, height: 800 },
        layoutMeasurement: { width: 750, height: 800 },
      },
    });
    expect(screen.getByLabelText('Page 3 of 3')).toBeOnTheScreen();
    expect(screen.getByText('Get started')).toBeOnTheScreen();
  });

  it('can be skipped', async () => {
    await logIn();
    await fireEvent.press(screen.getByTestId('tour-skip'));
    await fireEvent.press(await screen.findByTestId('setup-skip'));
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
  });

  it('stays away when the app reopens signed in', async () => {
    await reopenSignedIn();
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('welcome-tour')).toBeNull();
  });

  it('comes back if the app closed part-way through', async () => {
    useAuthStore.setState({ welcomePending: true });
    await reopenSignedIn();
    expect(await screen.findByTestId('welcome-tour')).toBeOnTheScreen();
  });

  it('is not repeated by a token refresh', async () => {
    await logIn();
    await fireEvent.press(screen.getByTestId('tour-skip'));
    await fireEvent.press(await screen.findByTestId('setup-skip'));
    await act(async () => emitAuth('TOKEN_REFRESHED', fakeSession()));
    expect(screen.queryByTestId('welcome-tour')).toBeNull();
  });

  it('shows again on the next log in', async () => {
    await logIn();
    await fireEvent.press(screen.getByTestId('tour-skip'));
    await fireEvent.press(await screen.findByTestId('setup-skip'));
    await act(async () => emitAuth('SIGNED_OUT', null));
    await screen.findByTestId('welcome-login');
    await act(async () => emitAuth('SIGNED_IN', fakeSession()));
    expect(await screen.findByTestId('welcome-tour')).toBeOnTheScreen();
  });

  it('waits until a new password is set', async () => {
    useAuthStore.setState({ passwordResetPending: 'reset' });
    useAuthStore.setState({ ready: true });
    await act(async () => useAuthStore.getState().setSession(fakeSession()));
    await reopenSignedIn();
    expect(await screen.findByTestId('password-new')).toBeOnTheScreen();
    expect(screen.queryByTestId('welcome-tour')).toBeNull();
    await act(async () =>
      useAuthStore.getState().setPasswordResetPending(false),
    );
    expect(await screen.findByTestId('welcome-tour')).toBeOnTheScreen();
  });
});

describe('Get started', () => {
  it.each([
    ['trip', 'Trip'],
    ['home', 'Home'],
  ])('opens Create group as a %s', async (type, label) => {
    await logIn();
    await fireEvent.press(screen.getByTestId('tour-skip'));
    await fireEvent.press(await screen.findByTestId(`setup-${type}`));
    expect(await screen.findByTestId('group-create')).toBeOnTheScreen();
    expect(screen.getByTestId(`group-type-${type}`)).toBeSelected();
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('stays out of the way of an invite link', async () => {
    useInviteStore.getState().setPendingToken('invite-token-1234567');
    await logIn();
    await fireEvent.press(screen.getByTestId('tour-skip'));
    expect(screen.queryByTestId('get-started')).toBeNull();
    useInviteStore.getState().setPendingToken(null);
  });

  it('comes back if the app closed on it', async () => {
    useAuthStore.setState({ setupPending: true });
    await reopenSignedIn();
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
  });
});
