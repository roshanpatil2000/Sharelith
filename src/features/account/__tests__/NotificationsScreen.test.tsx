import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithTheme } from '@/test/render';
import {
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationsScreen } from '../screens/NotificationsScreen';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));

it('shows each kind and saves a switch', async () => {
  useAuthStore.setState({ session: fakeSession() });
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'get_my_profile'
      ? { data: [fakeProfile({ notify_reminders: false })], error: null }
      : { data: null, error: null },
  );
  const update = queryBuilder({ data: null, error: null });
  supabaseMock.from.mockReturnValue(update as never);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await renderWithTheme(
    <QueryClientProvider client={qc}>
      <NotificationsScreen />
    </QueryClientProvider>,
  );

  const reminders = await screen.findByTestId('notify-notify_reminders');
  expect(reminders.props.value).toBe(false);
  expect(screen.getByTestId('notify-notify_expenses').props.value).toBe(true);

  await fireEvent(
    screen.getByTestId('notify-notify_expenses'),
    'valueChange',
    false,
  );
  await waitFor(() =>
    expect(update.update).toHaveBeenCalledWith({ notify_expenses: false }),
  );
});
