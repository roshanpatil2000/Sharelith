import React from 'react';
import { screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import { fakeSession, supabaseMock } from '@/test/supabaseMock';
import { useAuthStore } from '@/features/auth/authStore';
import { InsightsScreen } from '../screens/InsightsScreen';

const mockIsPro = jest.fn(() => false);
jest.mock('../pro', () => ({ useIsPro: () => mockIsPro() }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));

const renderScreen = () =>
  renderWithTheme(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <InsightsScreen />
    </QueryClientProvider>,
  );

beforeEach(() => useAuthStore.setState({ session: fakeSession() }));

it('is locked for free users', async () => {
  mockIsPro.mockReturnValue(false);
  await renderScreen();
  expect(screen.getByText('Insights are part of Pro')).toBeOnTheScreen();
  expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
    'spending_insights',
    expect.anything(),
  );
});

it('shows totals, months and categories for Pro users', async () => {
  mockIsPro.mockReturnValue(true);
  const month = new Date().toISOString().slice(0, 7) + '-01';
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'spending_insights'
      ? {
          data: [
            {
              month,
              category: 'food',
              currency: 'INR',
              share_minor: 1500,
              paid_minor: 3000,
              expense_count: 1,
            },
            {
              month,
              category: 'transport',
              currency: 'INR',
              share_minor: 500,
              paid_minor: 0,
              expense_count: 1,
            },
          ],
          error: null,
        }
      : { data: null, error: null },
  );
  await renderScreen();
  expect(await screen.findByTestId('insights-share')).toHaveTextContent(
    '₹20.00',
  );
  expect(screen.getByText('Food')).toBeOnTheScreen();
  expect(screen.getByText('75% of your share')).toBeOnTheScreen();
  expect(screen.getByText(/2 expenses/)).toBeOnTheScreen();
});
