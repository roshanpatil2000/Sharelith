import React from 'react';
import * as RN from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

async function openAt(width: number) {
  RN.Dimensions.set({
    window: { width, height: 900, scale: 2, fontScale: 1 },
    screen: { width, height: 900, scale: 2, fontScale: 1 },
  });
  mockProfiles(queryBuilder({ data: fakeProfile(), error: null }));
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
  await screen.findByText('No groups yet');
}

afterEach(() => jest.restoreAllMocks());

it.each([
  ['phone width', 390, false],
  ['wide screen (side rail)', 820, true],
])('shows all four tabs at %s', async (_name, width, rail) => {
  await openAt(width);
  // The bottom bar and the rail both render buttons; the strip doesn't apply here.
  expect(!!screen.queryByTestId('floating-tab-bar')).toBe(!rail);
  expect(screen.queryByTestId('strip-tab-Groups')).toBeNull();
  expect(RN.Dimensions.get('window').width >= 600).toBe(rail);
  for (const tab of ['Groups', 'Friends', 'Activity', 'Account']) {
    expect(
      screen.getByRole('button', { name: new RegExp(tab) }),
    ).toBeOnTheScreen();
  }
});

it.each([
  ['closed', 466],
  ['open', 951],
])(
  'puts round tab buttons in the side strip (%s iPhone Duo)',
  async (_p, width) => {
    // The safe-area mock's hook is a jest.fn; give it a Duo-like right strip.
    const hook = SafeArea.useSafeAreaInsets as jest.Mock;
    const original = hook.getMockImplementation();
    hook.mockImplementation(() => ({ top: 0, bottom: 20, left: 0, right: 80 }));
    await openAt(width);
    for (const tab of ['Groups', 'Friends', 'Activity', 'Account']) {
      expect(screen.getByTestId(`strip-tab-${tab}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('strip-tab-Groups')).toBeSelected();
    expect(screen.queryByTestId('floating-tab-bar')).toBeNull();
    hook.mockImplementation(original);
  },
);

it('switches tabs from the floating bar', async () => {
  await openAt(390);
  expect(screen.getByTestId('tab-Groups')).toBeSelected();
  await fireEvent.press(screen.getByTestId('tab-Friends'));
  expect(screen.getByTestId('tab-Friends')).toBeSelected();
  expect(screen.getByTestId('tab-Groups')).not.toBeSelected();
});
