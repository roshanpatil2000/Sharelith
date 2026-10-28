import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { useSessionStore } from '@/lib/sessionStore';

describe('App shell', () => {
  beforeEach(() => {
    useSessionStore.setState({ devSignedIn: false });
  });

  it('shows Welcome when signed out, then the tabs after dev skip', async () => {
    await render(<App />);
    expect(await screen.findByText('Sharelith')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('dev-skip'));

    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    for (const tab of ['Groups', 'Friends', 'Activity', 'Account']) {
      expect(screen.getAllByText(tab).length).toBeGreaterThan(0);
    }
  });

  it('opens Add expense from the FAB', async () => {
    useSessionStore.setState({ devSignedIn: true });
    await render(<App />);
    await fireEvent.press(await screen.findByTestId('fab'));
    expect(
      await screen.findByText(/Splitting and saving expenses/),
    ).toBeOnTheScreen();
  });
});
