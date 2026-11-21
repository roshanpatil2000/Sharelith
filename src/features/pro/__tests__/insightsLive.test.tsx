import React from 'react';
import { act, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fakeSession, supabaseMock } from '@/test/supabaseMock';
import { useAuthStore } from '@/features/auth/authStore';
import {
  insightsKey,
  useCreateExpense,
  useRefreshExpenses,
} from '@/features/expenses/api';
import { useDeleteGroup } from '@/features/groups/api';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));

/** Renders hooks once and hands back their results plus the query client. */
async function setup() {
  const qc = new QueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const hooks: {
    refresh?: ReturnType<typeof useRefreshExpenses>;
    create?: ReturnType<typeof useCreateExpense>;
    deleteGroup?: ReturnType<typeof useDeleteGroup>;
  } = {};
  function Probe() {
    hooks.refresh = useRefreshExpenses();
    hooks.create = useCreateExpense();
    hooks.deleteGroup = useDeleteGroup('g1');
    return null;
  }
  await render(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  );
  const refreshedInsights = () =>
    invalidate.mock.calls.some(
      ([f]) =>
        JSON.stringify(f?.queryKey) === JSON.stringify(insightsKey('user-1')),
    );
  return { hooks, invalidate, refreshedInsights };
}

beforeEach(() => {
  useAuthStore.setState({ session: fakeSession() });
  supabaseMock.rpc.mockImplementation(async () => ({
    data: 'new-id',
    error: null,
  }));
});

it('refreshes insights when someone else changes something (live update)', async () => {
  const { hooks, refreshedInsights } = await setup();
  await act(() => hooks.refresh!());
  expect(refreshedInsights()).toBe(true);
});

it('refreshes insights after you add an expense', async () => {
  const { hooks, refreshedInsights } = await setup();
  await act(() =>
    hooks.create!.mutateAsync({
      description: 'Lunch',
      amountMinor: 100,
      currency: 'INR',
      payers: [],
      shares: [],
    }),
  );
  expect(refreshedInsights()).toBe(true);
});

it('refreshes insights after a group is deleted', async () => {
  const { hooks, refreshedInsights } = await setup();
  await act(() => hooks.deleteGroup!.mutateAsync());
  expect(refreshedInsights()).toBe(true);
});
