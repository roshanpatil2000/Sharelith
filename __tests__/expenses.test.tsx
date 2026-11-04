import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
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

const member = (id: string, name: string, leftAt: string | null = null) => ({
  joined_at: '2026-10-29T00:00:00Z',
  left_at: leftAt,
  profile: {
    id,
    full_name: name,
    email: `${id}@example.com`,
    avatar_url: null,
    joined_at: '2026-10-29T00:00:00Z',
  },
});

const groupRow = {
  id: 'g-goa',
  name: 'Goa trip',
  description: null,
  type: 'trip',
  cover_url: null,
  currency: 'INR',
  simplify_debts: true,
  created_by: me,
  created_at: '2026-10-29T00:00:00Z',
  updated_at: '2026-10-29T00:00:00Z',
};

const dinner = {
  id: 'e-1',
  group_id: 'g-goa',
  description: 'Dinner',
  amount_minor: 90000,
  currency: 'INR',
  category: 'general',
  expense_date: '2026-11-02',
  is_payment: false,
  paid_by: me,
  payer_count: 1,
  my_net_minor: 60000,
};

type Backend = {
  expenses?: unknown[];
  balances?: unknown[];
  createError?: unknown;
};

function mockBackend({ expenses = [], balances = [], createError }: Backend) {
  supabaseMock.from.mockImplementation((() => {
    const builder = queryBuilder<unknown>({
      data: [{ ...groupRow, group_members: [{ count: 3 }] }],
      error: null,
    });
    builder.maybeSingle.mockResolvedValue({
      data: {
        ...groupRow,
        group_members: [
          member(me, 'Me Myself'),
          member(asha, 'Asha Rao'),
          member(vik, 'Vikram Shah'),
          member('f-gone', 'Gone Person', '2026-11-01T00:00:00Z'),
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
      case 'list_expenses':
        return { data: expenses, error: null };
      case 'list_my_balances':
        return { data: balances, error: null };
      case 'create_expense':
        return createError
          ? { data: null, error: createError }
          : { data: 'e-new', error: null };
      default:
        return { data: [], error: null };
    }
  });
}

async function openGroup() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
  await fireEvent.press(await screen.findByTestId('group-g-goa'));
  await screen.findByText('No expenses yet').catch(() => {});
}

const openForm = async () => {
  await openGroup();
  await fireEvent.press(await screen.findByTestId('group-add-expense'));
  await screen.findByTestId(`expense-include-${asha}`);
};

const fill = async (description: string, amount: string) => {
  await fireEvent.changeText(
    screen.getByTestId('expense-description'),
    description,
  );
  await fireEvent.changeText(screen.getByTestId('expense-amount'), amount);
};

const createCall = () =>
  supabaseMock.rpc.mock.calls.find(([fn]) => fn === 'create_expense')?.[1] as
    | Record<string, unknown>
    | undefined;

afterEach(() => {
  supabaseMock.rpc.mockReset();
  supabaseMock.from.mockReset();
});

describe('Add expense', () => {
  it('splits a group expense equally, reconciling exactly', async () => {
    mockBackend({});
    await openForm();
    await fill('Dinner', '100');
    expect(screen.getByTestId('expense-per-person')).toHaveTextContent(
      /33\.33 each/,
    );
    await fireEvent.press(screen.getByTestId('expense-save'));

    expect(await screen.findByText('Expense added')).toBeOnTheScreen();
    expect(createCall()).toMatchObject({
      description: 'Dinner',
      amount_minor: 10000,
      currency: 'INR',
      group_id: 'g-goa',
      payers: [{ user_id: me, paid_minor: 10000 }],
      shares: [
        { user_id: me, owed_minor: 3334 },
        { user_id: asha, owed_minor: 3333 },
        { user_id: vik, owed_minor: 3333 },
      ],
    });
  });

  it('leaves out people who are unticked', async () => {
    mockBackend({});
    await openForm();
    await fill('Taxi', '100');
    await fireEvent.press(screen.getByTestId(`expense-include-${vik}`));
    await fireEvent.press(screen.getByTestId('expense-save'));
    await screen.findByText('Expense added');
    expect(createCall()?.shares).toEqual([
      expect.objectContaining({ user_id: me, owed_minor: 5000 }),
      expect.objectContaining({ user_id: asha, owed_minor: 5000 }),
    ]);
  });

  it('does not offer people who left the group', async () => {
    mockBackend({});
    await openForm();
    expect(screen.queryByTestId('expense-include-f-gone')).toBeNull();
  });

  it.each([
    ['', '100', 'Enter a description.'],
    ['Dinner', '', 'Enter an amount.'],
  ])('rejects %s / %s without saving', async (name, amount, message) => {
    mockBackend({});
    await openForm();
    await fill(name, amount);
    await fireEvent.press(screen.getByTestId('expense-save'));
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(createCall()).toBeUndefined();
  });

  it('needs someone to split with', async () => {
    mockBackend({});
    await openForm();
    await fill('Dinner', '100');
    for (const id of [me, asha, vik]) {
      await fireEvent.press(screen.getByTestId(`expense-include-${id}`));
    }
    await fireEvent.press(screen.getByTestId('expense-save'));
    expect(
      await screen.findByText('Choose at least one person to split with.'),
    ).toBeOnTheScreen();
    expect(createCall()).toBeUndefined();
  });

  it('shows the server’s reason when it refuses', async () => {
    mockBackend({
      createError: {
        code: 'P0001',
        hint: 'invalid_expense',
        message: 'The split must add up to the total',
      },
    });
    await openForm();
    await fill('Dinner', '100');
    await fireEvent.press(screen.getByTestId('expense-save'));
    expect(
      await screen.findByText('The split must add up to the total'),
    ).toBeOnTheScreen();
  });
});

describe('Group expenses', () => {
  it('lists expenses and shows the real balance', async () => {
    mockBackend({
      expenses: [dinner],
      balances: [
        {
          friend_id: asha,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: 30000,
        },
        {
          friend_id: vik,
          group_id: 'g-goa',
          currency: 'INR',
          net_minor: 30000,
        },
      ],
    });
    await openGroup();
    expect(await screen.findByText('Dinner')).toBeOnTheScreen();
    expect(screen.getByText(/You paid/)).toBeOnTheScreen();
    expect(screen.getByText('you lent')).toBeOnTheScreen();
    expect(screen.getAllByText(/600\.00/).length).toBeGreaterThan(0);
  });

  it('names a payer who has since left', async () => {
    mockBackend({
      expenses: [{ ...dinner, paid_by: 'f-gone', my_net_minor: -30000 }],
    });
    await openGroup();
    expect(await screen.findByText(/Gone paid/)).toBeOnTheScreen();
    expect(screen.getByText('you borrowed')).toBeOnTheScreen();
  });
});

describe('Groups tab totals', () => {
  // Mirrors the real data: ₹101 owed in a group, ₹45 owed outside any group.
  const balances = [
    { friend_id: asha, group_id: 'g-goa', currency: 'INR', net_minor: -10100 },
    { friend_id: asha, group_id: null, currency: 'INR', net_minor: -4500 },
  ];

  const openGroupsTab = async () => {
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: fakeSession() },
      error: null,
    });
    await render(<App />);
    await screen.findByTestId('group-g-goa');
  };

  it('shows the same overall total as the Friends tab', async () => {
    mockBackend({ balances });
    await openGroupsTab();
    expect(await screen.findByText(/146\.00/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Friends/ }));
    expect(await screen.findAllByText(/146\.00/)).not.toHaveLength(0);
  });

  it('lists non-group expenses so the rows add up', async () => {
    mockBackend({ balances });
    await openGroupsTab();
    expect(await screen.findByTestId('groups-non-group')).toBeOnTheScreen();
    expect(screen.getByText(/45\.00/)).toBeOnTheScreen();
  });

  it('says you are owed on a group row, not that the group owes you', async () => {
    mockBackend({
      balances: [{ ...balances[0]!, net_minor: 10100 }],
    });
    await openGroupsTab();
    expect(await screen.findByText('you are owed')).toBeOnTheScreen();
    expect(screen.queryByTestId('groups-non-group')).toBeNull();
  });
});
