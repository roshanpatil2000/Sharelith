import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import {
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';

const me = 'user-1';
const asha = 'f-asha';
const vik = 'f-vik';

const member = (id: string, name: string) => ({
  joined_at: '2026-10-29T00:00:00Z',
  left_at: null,
  profile: {
    id,
    full_name: name,
    email: `${id}@example.com`,
    avatar_url: null,
    joined_at: '2026-10-29T00:00:00Z',
  },
});

const friend = (id: string, name: string) => ({
  id,
  full_name: name,
  email: `${id}@example.com`,
  avatar_url: null,
  invited: false,
  friends_since: '2026-10-29T00:00:00Z',
});

const groupRow = (simplify: boolean) => ({
  id: 'g-goa',
  name: 'Goa trip',
  description: null,
  type: 'trip',
  cover_url: null,
  currency: 'INR',
  simplify_debts: simplify,
  created_by: me,
  created_at: '2026-10-29T00:00:00Z',
  updated_at: '2026-10-29T00:00:00Z',
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'p-1',
  group_id: 'g-goa',
  description: 'Payment',
  amount_minor: 25000,
  currency: 'INR',
  category: 'payment',
  expense_date: '2026-11-04',
  is_payment: true,
  created_by: asha,
  paid_by: asha,
  paid_to: me,
  payer_count: 1,
  my_net_minor: -25000,
  ...overrides,
});

type Backend = {
  balances?: unknown[];
  groupBalances?: unknown[];
  expenses?: unknown[];
  simplify?: boolean;
};

function mockBackend({
  balances = [],
  groupBalances = [],
  expenses = [],
  simplify = true,
}: Backend) {
  supabaseMock.from.mockImplementation((() => {
    const builder = queryBuilder<unknown>({
      data: [{ ...groupRow(simplify), group_members: [{ count: 3 }] }],
      error: null,
    });
    builder.maybeSingle.mockResolvedValue({
      data: {
        ...groupRow(simplify),
        group_members: [
          member(me, 'Me Myself'),
          member(asha, 'Asha Rao'),
          member(vik, 'Vikram Shah'),
        ],
      },
      error: null,
    });
    return builder;
  }) as never);
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    switch (fn) {
      case 'get_my_profile':
        return {
          data: [fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' })],
          error: null,
        };
      case 'list_friends':
        return {
          data: [friend(asha, 'Asha Rao'), friend(vik, 'Vikram Shah')],
          error: null,
        };
      case 'list_expenses':
        return { data: expenses, error: null };
      case 'list_my_balances':
        return { data: balances, error: null };
      case 'list_group_balances':
        return { data: groupBalances, error: null };
      case 'record_payment':
        return { data: 'p-new', error: null };
      default:
        return { data: [], error: null };
    }
  });
}

async function openApp() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
}

async function openGroup() {
  await openApp();
  await fireEvent.press(await screen.findByTestId('group-g-goa'));
  await screen.findByText('Goa trip');
}

const paymentCall = () =>
  supabaseMock.rpc.mock.calls.find(([fn]) => fn === 'record_payment')?.[1];

afterEach(() => {
  supabaseMock.rpc.mockReset();
  supabaseMock.from.mockReset();
});

describe('Settle up in a group', () => {
  it('suggests your simplified payment and records it', async () => {
    // You owe Vikram directly, but simplified you pay Asha instead.
    mockBackend({
      balances: [
        {
          friend_id: vik,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: -30000,
        },
      ],
      groupBalances: [
        { user_id: me, currency: 'INR', net_minor: -30000 },
        { user_id: asha, currency: 'INR', net_minor: 50000 },
        { user_id: vik, currency: 'INR', net_minor: -20000 },
      ],
    });
    await openGroup();
    await fireEvent.press(await screen.findByTestId('group-settle-up'));

    expect(await screen.findByText('You pay Asha')).toBeOnTheScreen();
    expect(screen.getByTestId('settle-amount').props.value).toBe('300');
    expect(screen.queryByTestId('settle-choice')).toBeNull();

    await fireEvent.press(screen.getByTestId('settle-save'));
    expect(await screen.findByText('Payment recorded')).toBeOnTheScreen();
    expect(paymentCall()).toEqual({
      payer: me,
      payee: asha,
      amount_minor: 30000,
      currency: 'INR',
      group_id: 'g-goa',
    });
  });

  it('pays people back directly when simplify is off', async () => {
    mockBackend({
      simplify: false,
      balances: [
        {
          friend_id: asha,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: 10000,
        },
        {
          friend_id: vik,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: -40000,
        },
      ],
    });
    await openGroup();
    await fireEvent.press(await screen.findByTestId('group-settle-up'));

    // The biggest is chosen first; the other is a pick away.
    expect(await screen.findByText('You pay Vikram')).toBeOnTheScreen();
    expect(screen.getByTestId('settle-choice')).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      'list_group_balances',
      expect.anything(),
    );
  });

  it('records part of a payment and says what is left', async () => {
    mockBackend({
      simplify: false,
      balances: [
        {
          friend_id: asha,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: 10000,
        },
      ],
    });
    await openGroup();
    await fireEvent.press(await screen.findByTestId('group-settle-up'));

    expect(await screen.findByText('Asha pays you')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('settle-amount'), '40');
    expect(screen.getByTestId('settle-left')).toHaveTextContent(
      /60\.00 will still be owed/,
    );
    await fireEvent.press(screen.getByTestId('settle-save'));
    await waitFor(() => expect(paymentCall()).toBeDefined());
    expect(paymentCall()).toMatchObject({
      payer: asha,
      payee: me,
      amount_minor: 4000,
    });
  });

  it('has no Settle up button once you are settled', async () => {
    mockBackend({});
    await openGroup();
    await screen.findByText('You are all settled up');
    expect(screen.queryByTestId('group-settle-up')).toBeNull();
  });
});

describe('Settle up with a friend', () => {
  it('offers each group and non-group balance separately', async () => {
    mockBackend({
      balances: [
        {
          friend_id: asha,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: -20000,
        },
        { friend_id: asha, group_id: null, currency: 'INR', net_minor: 5000 },
      ],
    });
    await openApp();
    await fireEvent.press(
      await screen.findByRole('button', { name: /Friends/ }),
    );
    await fireEvent.press(await screen.findByTestId(`friend-${asha}`));
    await fireEvent.press(await screen.findByTestId('friend-settle-up'));

    expect(await screen.findByText('You pay Asha')).toBeOnTheScreen();
    // Also listed among the picker's choices.
    expect(screen.getAllByText('In Goa trip').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Outside groups').length).toBeGreaterThan(0);
    expect(screen.getByTestId('settle-choice')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('settle-save'));
    await waitFor(() => expect(paymentCall()).toBeDefined());
    expect(paymentCall()).toMatchObject({
      payer: me,
      payee: asha,
      amount_minor: 20000,
      group_id: 'g-goa',
    });
  });
});

describe('Payments in the list', () => {
  it('says who paid whom, and cannot be edited', async () => {
    mockBackend({ expenses: [payment()] });
    await openGroup();

    expect(await screen.findByText('Asha paid you')).toBeOnTheScreen();
    expect(screen.getByText('you received')).toBeOnTheScreen();
    expect(screen.queryByTestId('expense-edit-p-1')).toBeNull();
    // Someone else recorded it: no delete either.
    expect(
      screen.getByTestId('expense-p-1').props.accessibilityActions,
    ).toBeUndefined();
  });

  it('can be deleted by whoever recorded it', async () => {
    mockBackend({
      expenses: [
        payment({
          created_by: me,
          paid_by: me,
          paid_to: asha,
          my_net_minor: 25000,
        }),
      ],
    });
    await openGroup();
    expect(await screen.findByText('You paid Asha')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('expense-p-1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(screen.getByText('Delete this payment?')).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button', { name: 'Delete' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(await screen.findByText('Deleted payment')).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('set_expense_deleted', {
      eid: 'p-1',
      deleted: true,
    });
  });
});
