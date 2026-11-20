import React from 'react';
import { screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import { fakeSession, supabaseMock } from '@/test/supabaseMock';
import { useAuthStore } from '@/features/auth/authStore';
import { ProScreen } from '../screens/ProScreen';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

const status = (row: Record<string, unknown> | null) =>
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'my_pro_status'
      ? { data: row ? [row] : [], error: null }
      : { data: null, error: null },
  );

const renderScreen = () =>
  renderWithTheme(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ProScreen />
    </QueryClientProvider>,
  );

beforeEach(() => useAuthStore.setState({ session: fakeSession() }));

it('lists the benefits, and says Pro is coming on iPhone', async () => {
  status({ is_pro: false, product_id: null, status: null, expires_at: null });
  await renderScreen();
  for (const b of ['No ads', 'Receipt photos', 'Export', 'Insights']) {
    expect(screen.getByText(b)).toBeOnTheScreen();
  }
  expect(await screen.findByTestId('pro-unsupported')).toBeOnTheScreen();
});

it('shows when Pro renews and offers to manage it', async () => {
  status({
    is_pro: true,
    product_id: 'pro_yearly',
    status: 'active',
    expires_at: '2027-11-20T00:00:00Z',
  });
  await renderScreen();
  expect(await screen.findByTestId('pro-active')).toHaveTextContent(
    /Renews on/,
  );
  expect(screen.getByTestId('pro-manage')).toBeOnTheScreen();
});
