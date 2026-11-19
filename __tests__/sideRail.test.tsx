import React from 'react';
import * as RN from 'react-native';
import { render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  fakeProfile,
  fakeSession,
  mockProfiles,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

async function openAt(width: number) {
  jest
    .spyOn(RN, 'useWindowDimensions')
    .mockReturnValue({ width, height: 900, scale: 2, fontScale: 1 });
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
  ['phone width', 390],
  ['wide screen (side rail)', 820],
])('shows all four tabs at %s', async (_name, width) => {
  await openAt(width);
  for (const tab of ['Groups', 'Friends', 'Activity', 'Account']) {
    expect(
      screen.getByRole('button', { name: new RegExp(tab) }),
    ).toBeOnTheScreen();
  }
});
