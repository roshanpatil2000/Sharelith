import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  emitRealtime,
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

const me = 'user-1';

const added = {
  id: 7,
  kind: 'expense_added',
  created_at: new Date().toISOString(),
  actor_id: 'f-asha',
  actor_name: 'Asha Rao',
  subject_id: null,
  subject_name: null,
  group_id: 'g-goa',
  group_name: 'Goa trip',
  expense_id: 'e-1',
  description: 'Dinner',
  amount_minor: 90000,
  currency: 'INR',
  net_minor: -30000,
  paid_by: null,
  payer_name: null,
  paid_to: null,
  payee_name: null,
};

function mockBackend(activity: unknown[]) {
  supabaseMock.from.mockImplementation((() =>
    queryBuilder<unknown>({ data: [], error: null })) as never);
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    switch (fn) {
      case 'get_my_profile':
        return {
          data: [fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' })],
          error: null,
        };
      case 'list_activity':
        return { data: activity, error: null };
      default:
        return { data: [], error: null };
    }
  });
}

async function openActivity() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
  await fireEvent.press(
    await screen.findByRole('button', { name: /Activity/ }),
  );
}

const calls = (fn: string) =>
  supabaseMock.rpc.mock.calls.filter(([name]) => name === fn).length;

afterEach(() => {
  supabaseMock.rpc.mockReset();
  supabaseMock.from.mockReset();
});

describe('Activity', () => {
  it('lists what happened, with what it means for you', async () => {
    mockBackend([
      added,
      {
        ...added,
        id: 6,
        kind: 'member_added',
        expense_id: null,
        description: null,
        amount_minor: null,
        currency: null,
        net_minor: 0,
        actor_id: me,
        subject_id: 'f-vik',
        subject_name: 'Vikram Shah',
      },
    ]);
    await openActivity();

    expect(
      await screen.findByText('Asha added “Dinner” in Goa trip'),
    ).toBeOnTheScreen();
    expect(screen.getByText('you owe')).toBeOnTheScreen();
    expect(screen.getByText('₹300.00')).toBeOnTheScreen();
    expect(
      screen.getByText('You added Vikram to “Goa trip”'),
    ).toBeOnTheScreen();
  });

  it('shows an empty state before anything has happened', async () => {
    mockBackend([]);
    await openActivity();
    expect(await screen.findByText('No activity yet')).toBeOnTheScreen();
  });

  it('opens the group when an entry is tapped', async () => {
    mockBackend([added]);
    await openActivity();
    await fireEvent.press(await screen.findByTestId('activity-7'));
    expect(supabaseMock.from).toHaveBeenCalledWith('groups');
  });
});

describe('Live updates', () => {
  it('listens only for your own activity', async () => {
    mockBackend([]);
    await openActivity();
    expect(supabaseMock.channel).toHaveBeenCalledWith(`activity:${me}`);
    const channel = supabaseMock.channel.mock.results.at(-1)!.value;
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        table: 'activity_recipients',
        filter: `user_id=eq.${me}`,
      }),
      expect.any(Function),
    );
  });

  it('reloads balances and the feed when someone else changes something', async () => {
    jest.useFakeTimers();
    try {
      mockBackend([]);
      await openActivity();
      await screen.findByText('No activity yet');
      const balances = calls('list_my_balances');
      const feed = calls('list_activity');

      // A burst of rows from one change refreshes once.
      await act(async () => {
        emitRealtime();
        emitRealtime();
        emitRealtime();
        await jest.advanceTimersByTimeAsync(400);
      });

      expect(calls('list_my_balances')).toBe(balances + 1);
      expect(calls('list_activity')).toBe(feed + 1);
    } finally {
      jest.useRealTimers();
    }
  });
});
