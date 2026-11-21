import React from 'react';
import { screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import { ConvertedTotal } from '../ConvertedTotal';

const mockIsPro = jest.fn(() => true);
jest.mock('@/features/pro/pro', () => ({ useIsPro: () => mockIsPro() }));
jest.mock('@/features/account/api', () => ({
  useProfile: () => ({ data: { default_currency: 'INR' } }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      base: 'INR',
      date: '2026-11-20',
      rates: { USD: 0.012 },
    }),
  });
  globalThis.fetch = fetchMock as never;
});

const renderTotal = (balances: { currency: string; minor: number }[]) =>
  renderWithTheme(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ConvertedTotal balances={balances} />
    </QueryClientProvider>,
  );

it('adds balances in several currencies in your currency (Pro)', async () => {
  mockIsPro.mockReturnValue(true);
  await renderTotal([
    { currency: 'INR', minor: 50000 },
    { currency: 'USD', minor: 1200 },
  ]);
  expect(await screen.findByTestId('converted-total')).toHaveTextContent(
    /In all, about ₹1,500\.00 owed to you/,
  );
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.frankfurter.dev/v1/latest?base=INR',
  );
});

it('says nothing for a single currency, and fetches nothing', async () => {
  await renderTotal([{ currency: 'INR', minor: 50000 }]);
  expect(screen.queryByTestId('converted-total')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('points free users to Pro instead', async () => {
  mockIsPro.mockReturnValue(false);
  await renderTotal([
    { currency: 'INR', minor: 50000 },
    { currency: 'USD', minor: 1200 },
  ]);
  expect(screen.getByText('See it all in INR with Pro')).toBeOnTheScreen();
  expect(fetchMock).not.toHaveBeenCalled();
});
