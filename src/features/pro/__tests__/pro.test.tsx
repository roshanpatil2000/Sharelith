import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fakeSession, supabaseMock } from '@/test/supabaseMock';
import { useAuthStore } from '@/features/auth/authStore';
import { useIsPro } from '../pro';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));

function Probe() {
  return <Text>{String(useIsPro())}</Text>;
}

const renderProbe = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Probe />
    </QueryClientProvider>,
  );

beforeEach(() => useAuthStore.setState({ session: fakeSession() }));

it('is Pro when the server says so', async () => {
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'my_pro_status'
      ? {
          data: [
            {
              is_pro: true,
              product_id: 'pro_yearly',
              status: 'active',
              expires_at: null,
            },
          ],
          error: null,
        }
      : { data: null, error: null },
  );
  await renderProbe();
  expect(await screen.findByText('true')).toBeOnTheScreen();
});

it('is free while loading and when the check fails', async () => {
  supabaseMock.rpc.mockImplementation(async () => ({
    data: null,
    error: { message: 'offline' },
  }));
  await renderProbe();
  expect(screen.getByText('false')).toBeOnTheScreen();
});
