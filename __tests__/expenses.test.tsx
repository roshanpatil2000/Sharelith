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
  created_by: me,
  paid_by: me,
  payer_count: 1,
  my_net_minor: 60000,
};

type Backend = {
  expenses?: unknown[];
  balances?: unknown[];
  createError?: unknown;
  /** What useExpense loads, for editing. */
  detail?: unknown;
};

function mockBackend({
  expenses = [],
  balances = [],
  createError,
  detail = null,
}: Backend) {
  supabaseMock.from.mockImplementation(((table: string) => {
    if (table === 'expenses') {
      return queryBuilder<unknown>({ data: detail, error: null });
    }
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
    // Each person's real share: the extra paisa goes to the first.
    expect(screen.getByTestId(`expense-owed-${me}`)).toHaveTextContent(
      '₹33.34',
    );
    expect(screen.getByTestId(`expense-owed-${vik}`)).toHaveTextContent(
      '₹33.33',
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

describe('Split types', () => {
  const chooseType = (label: string) =>
    fireEvent.press(screen.getByRole('tab', { name: label }));
  const type = (id: string, text: string) =>
    fireEvent.changeText(screen.getByTestId(`expense-split-${id}`), text);
  const save = async () => {
    await fireEvent.press(screen.getByTestId('expense-save'));
  };

  it('splits by exact amounts once they add up', async () => {
    mockBackend({});
    await openForm();
    await fill('Groceries', '100');
    await chooseType('Exact');
    await type(me, '50');
    await type(asha, '30');
    expect(screen.getByTestId('expense-split-status')).toHaveTextContent(
      '₹20.00 left to assign',
    );
    await save();
    expect(await screen.findByText('₹20.00 left to assign')).toBeOnTheScreen();
    expect(createCall()).toBeUndefined();

    await type(vik, '20');
    await save();
    await screen.findByText('Expense added');
    expect(createCall()?.shares).toEqual([
      { user_id: me, owed_minor: 5000, split_type: 'exact', raw_value: null },
      { user_id: asha, owed_minor: 3000, split_type: 'exact', raw_value: null },
      { user_id: vik, owed_minor: 2000, split_type: 'exact', raw_value: null },
    ]);
  });

  it('splits by percent, keeping the percentages', async () => {
    mockBackend({});
    await openForm();
    await fill('Rent', '1000');
    await chooseType('%');
    await type(me, '50');
    await type(asha, '25');
    expect(screen.getByTestId('expense-split-status')).toHaveTextContent(
      '25% left to assign',
    );
    await type(vik, '25');
    expect(screen.getByTestId(`expense-split-${me}-result`)).toHaveTextContent(
      '₹500.00',
    );
    await save();
    await screen.findByText('Expense added');
    expect(createCall()?.shares).toEqual([
      { user_id: me, owed_minor: 50000, split_type: 'percent', raw_value: 50 },
      {
        user_id: asha,
        owed_minor: 25000,
        split_type: 'percent',
        raw_value: 25,
      },
      { user_id: vik, owed_minor: 25000, split_type: 'percent', raw_value: 25 },
    ]);
  });

  it('splits by shares, starting at one each', async () => {
    mockBackend({});
    await openForm();
    await fill('Fuel', '100');
    await chooseType('Shares');
    expect(screen.getByTestId(`expense-split-${asha}`)).toHaveDisplayValue('1');
    await type(me, '2');
    expect(screen.getByTestId(`expense-split-${me}-result`)).toHaveTextContent(
      '₹50.00',
    );
    await save();
    await screen.findByText('Expense added');
    expect(createCall()?.shares).toEqual([
      { user_id: me, owed_minor: 5000, split_type: 'shares', raw_value: 2 },
      { user_id: asha, owed_minor: 2500, split_type: 'shares', raw_value: 1 },
      { user_id: vik, owed_minor: 2500, split_type: 'shares', raw_value: 1 },
    ]);
  });

  it('adds adjustments on top of an equal split', async () => {
    mockBackend({});
    await openForm();
    await fill('Hotel', '100');
    await chooseType('+/−');
    await type(me, '10');
    await type(asha, '-4');
    await save();
    await screen.findByText('Expense added');
    // 100 − 6 = 94 split three ways (31.34, 31.33, 31.33), then +10 / −4.
    expect(createCall()?.shares).toEqual([
      {
        user_id: me,
        owed_minor: 4134,
        split_type: 'adjustment',
        raw_value: 1000,
      },
      {
        user_id: asha,
        owed_minor: 2733,
        split_type: 'adjustment',
        raw_value: -400,
      },
      {
        user_id: vik,
        owed_minor: 3133,
        split_type: 'adjustment',
        raw_value: 0,
      },
    ]);
  });

  it('records several payers once they add up', async () => {
    mockBackend({});
    await openForm();
    await fill('Dinner', '90');
    await fireEvent.press(screen.getByTestId('expense-paid-by'));
    await fireEvent.press(
      screen.getByTestId('expense-paid-by-option-multiple'),
    );
    // Starts with you paying it all.
    expect(screen.getByTestId(`expense-paid-${me}`)).toHaveDisplayValue('90');
    await fireEvent.changeText(screen.getByTestId(`expense-paid-${me}`), '60');
    expect(screen.getByTestId('expense-paid-status')).toHaveTextContent(
      '₹30.00 of the total still unpaid',
    );
    await fireEvent.changeText(
      screen.getByTestId(`expense-paid-${asha}`),
      '30',
    );
    await save();
    await screen.findByText('Expense added');
    expect(createCall()?.payers).toEqual([
      { user_id: me, paid_minor: 6000 },
      { user_id: asha, paid_minor: 3000 },
    ]);
  });

  it('opens a percent split to edit as it was entered', async () => {
    mockBackend({
      expenses: [dinner],
      detail: {
        ...dinnerDetail,
        expense_payers: [
          { user_id: me, paid_minor: 45000 },
          { user_id: asha, paid_minor: 45000 },
        ],
        expense_shares: [
          {
            user_id: me,
            owed_minor: 45000,
            split_type: 'percent',
            raw_value: 50,
          },
          {
            user_id: vik,
            owed_minor: 45000,
            split_type: 'percent',
            raw_value: 50,
          },
        ],
      },
    });
    await openGroup();
    await fireEvent.press(await screen.findByTestId('expense-e-1'));
    await screen.findByTestId('expense-description');

    expect(screen.getByRole('tab', { name: '%' })).toBeSelected();
    expect(screen.getByTestId(`expense-split-${vik}`)).toHaveDisplayValue('50');
    expect(screen.getByTestId(`expense-paid-${asha}`)).toHaveDisplayValue(
      '450',
    );
    await type(me, '60');
    await type(vik, '40');
    await save();
    await screen.findByText('Expense saved');
    expect(rpcCall('update_expense')).toMatchObject({
      payers: [
        { user_id: me, paid_minor: 45000 },
        { user_id: asha, paid_minor: 45000 },
      ],
      shares: [
        { user_id: me, owed_minor: 54000, raw_value: 60 },
        { user_id: vik, owed_minor: 36000, raw_value: 40 },
      ],
    });
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

/** Dinner as useExpense loads it: Me paid ₹900, split three ways. */
const dinnerDetail = {
  id: 'e-1',
  group_id: 'g-goa',
  description: 'Dinner',
  amount_minor: 90000,
  currency: 'INR',
  expense_date: '2026-11-02',
  created_by: me,
  expense_payers: [{ user_id: me, paid_minor: 90000 }],
  expense_shares: [me, asha, vik].map(user_id => ({
    user_id,
    owed_minor: 30000,
    split_type: 'equal',
    raw_value: null,
  })),
};

const rpcCall = (name: string) =>
  supabaseMock.rpc.mock.calls.find(([fn]) => fn === name)?.[1] as
    | Record<string, unknown>
    | undefined;

describe('Edit expense', () => {
  const openEdit = async (detail: unknown) => {
    mockBackend({ expenses: [dinner], detail });
    await openGroup();
    await fireEvent.press(await screen.findByTestId('expense-e-1'));
    await screen.findByTestId('expense-description');
  };

  it('opens filled in when the row is tapped', async () => {
    await openEdit(dinnerDetail);
    expect(screen.getByTestId('expense-description')).toHaveDisplayValue(
      'Dinner',
    );
    expect(screen.getByTestId('expense-amount')).toHaveDisplayValue('900');
    expect(screen.getByTestId(`expense-owed-${asha}`)).toHaveTextContent(
      '₹300.00',
    );
  });

  it('saves a new name and amount, splitting again equally', async () => {
    await openEdit(dinnerDetail);
    await fireEvent.changeText(
      screen.getByTestId('expense-description'),
      'Team dinner',
    );
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '1000');
    await fireEvent.press(screen.getByTestId('expense-save'));

    expect(await screen.findByText('Expense saved')).toBeOnTheScreen();
    expect(rpcCall('update_expense')).toMatchObject({
      eid: 'e-1',
      description: 'Team dinner',
      amount_minor: 100000,
      payers: [{ user_id: me, paid_minor: 100000 }],
      shares: [
        { user_id: me, owed_minor: 33334 },
        { user_id: asha, owed_minor: 33333 },
        { user_id: vik, owed_minor: 33333 },
      ],
    });
    expect(rpcCall('create_expense')).toBeUndefined();
  });

  it('only renames an expense with someone who has left', async () => {
    const withGone = {
      ...dinnerDetail,
      expense_shares: [
        {
          user_id: me,
          owed_minor: 45000,
          split_type: 'equal',
          raw_value: null,
        },
        {
          user_id: 'f-gone',
          owed_minor: 45000,
          split_type: 'equal',
          raw_value: null,
        },
      ],
    };
    await openEdit(withGone);
    expect(screen.getByText(/no longer here/)).toBeOnTheScreen();
    expect(screen.queryByTestId('expense-amount')).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId('expense-description'),
      'Renamed',
    );
    await fireEvent.press(screen.getByTestId('expense-save'));

    await screen.findByText('Expense saved');
    expect(rpcCall('rename_expense')).toEqual({
      eid: 'e-1',
      description: 'Renamed',
    });
    expect(rpcCall('update_expense')).toBeUndefined();
  });

  it('lets others rename an expense but not change its amount', async () => {
    await openEdit({ ...dinnerDetail, created_by: asha });
    expect(
      screen.getByText(/Only Asha Rao can change the amount or delete/),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('expense-amount')).toBeNull();
    expect(screen.queryByTestId('expense-paid-by')).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId('expense-description'),
      'Asha’s dinner',
    );
    await fireEvent.press(screen.getByTestId('expense-save'));

    await screen.findByText('Expense saved');
    expect(rpcCall('rename_expense')).toEqual({
      eid: 'e-1',
      description: 'Asha’s dinner',
    });
    expect(rpcCall('update_expense')).toBeUndefined();
  });
});

describe('Delete expense', () => {
  const openList = async () => {
    mockBackend({ expenses: [dinner] });
    await openGroup();
    await screen.findByTestId('expense-e-1');
  };

  // Swipe actions can't be pressed until the row is swiped open, which
  // Jest can't do; the row's accessibility action calls the same handler.
  const askToDelete = () =>
    fireEvent(screen.getByTestId('expense-e-1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

  it('deletes after confirming, and can undo', async () => {
    await openList();
    await askToDelete();
    const buttons = screen.getAllByRole('button', { name: 'Delete' });
    await fireEvent.press(buttons[buttons.length - 1]!);

    expect(await screen.findByText('Deleted “Dinner”')).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('set_expense_deleted', {
      eid: 'e-1',
      deleted: true,
    });

    await fireEvent.press(screen.getByTestId('toast-action'));
    expect(supabaseMock.rpc).toHaveBeenCalledWith('set_expense_deleted', {
      eid: 'e-1',
      deleted: false,
    });
  });

  it('does nothing if the confirmation is cancelled', async () => {
    await openList();
    await askToDelete();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(rpcCall('set_expense_deleted')).toBeUndefined();
  });

  it('puts Edit and Delete behind the row', async () => {
    await openList();
    expect(screen.getByTestId('expense-edit-e-1')).toBeTruthy();
    expect(screen.getByTestId('expense-delete-e-1')).toBeTruthy();
  });

  it('offers edit and delete to screen readers without a swipe', async () => {
    await openList();
    const row = screen.getByTestId('expense-e-1');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'edit', label: 'Edit' },
      { name: 'delete', label: 'Delete' },
    ]);
    await fireEvent(row, 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(await screen.findByText('Delete “Dinner”?')).toBeOnTheScreen();
  });
});

describe('Someone else’s expense', () => {
  it('cannot be deleted from the list', async () => {
    mockBackend({ expenses: [{ ...dinner, created_by: asha }] });
    await openGroup();
    const row = await screen.findByTestId('expense-e-1');
    expect(screen.queryByTestId('expense-delete-e-1')).toBeNull();
    expect(screen.getByTestId('expense-edit-e-1')).toBeTruthy();
    expect(row.props.accessibilityActions).toEqual([
      { name: 'edit', label: 'Rename' },
    ]);
  });

  it('shows the server’s reason if a delete is refused', async () => {
    mockBackend({ expenses: [dinner] });
    await openGroup();
    await fireEvent(
      await screen.findByTestId('expense-e-1'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'delete' } },
    );
    const buttons = screen.getAllByRole('button', { name: 'Delete' });
    supabaseMock.rpc.mockImplementationOnce(async () => ({
      data: null,
      error: {
        code: '42501',
        hint: 'not_creator',
        message:
          'Only the person who added this expense can change its amount or delete it',
      },
    }));
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(
      await screen.findByText(/Only the person who added this expense/),
    ).toBeOnTheScreen();
  });
});

describe('Data from other people', () => {
  const balanceCalls = () =>
    supabaseMock.rpc.mock.calls.filter(([fn]) => fn === 'list_my_balances')
      .length;

  it('reloads balances when you come back to a tab', async () => {
    mockBackend({});
    supabaseMock.auth.getSession.mockResolvedValueOnce({
      data: { session: fakeSession() },
      error: null,
    });
    await render(<App />);
    await screen.findByTestId('group-g-goa');
    const before = balanceCalls();

    await fireEvent.press(screen.getByRole('button', { name: /Friends/ }));
    await fireEvent.press(screen.getByRole('button', { name: /Groups/ }));

    await waitFor(() => expect(balanceCalls()).toBeGreaterThan(before));
  });
});
