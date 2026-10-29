import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import {
  fakeProfile,
  fakeSession,
  queryBuilder,
  supabaseMock,
} from '@/test/supabaseMock';
import type { Friend } from '@/features/friends/api';

const asha: Friend = {
  id: 'f-asha',
  full_name: 'Asha Rao',
  email: 'asha@example.com',
  avatar_url: null,
  invited: false,
  friends_since: '2026-10-29T00:00:00Z',
};
const vik: Friend = {
  id: 'f-vik',
  full_name: 'Vikram Shah',
  email: 'vik@example.com',
  avatar_url: null,
  invited: true,
  friends_since: '2026-10-29T00:00:00Z',
};

const goaRow = {
  id: 'g-goa',
  name: 'Goa trip',
  description: null,
  type: 'trip',
  cover_url: null,
  currency: 'INR',
  simplify_debts: true,
  created_by: 'user-1',
  created_at: '2026-10-29T00:00:00Z',
  updated_at: '2026-10-29T00:00:00Z',
};

const member = (id: string, name: string, joined: string) => ({
  joined_at: joined,
  profile: {
    id,
    full_name: name,
    email: `${id}@example.com`,
    avatar_url: null,
    joined_at: joined,
  },
});

/** The group as useGroup() reads it: me (user-1) plus Asha. */
const goaDetail = (createdBy = 'user-1') => ({
  ...goaRow,
  created_by: createdBy,
  group_members: [
    member('user-1', 'Me Myself', '2026-10-29T00:00:00Z'),
    member('f-asha', 'Asha Rao', '2026-10-29T00:01:00Z'),
  ],
});

type Setup = {
  groups?: unknown[];
  detail?: unknown;
  friends?: Friend[];
};

/** Routes supabase.from() by table and rpc() by function name. */
function mockBackend({ groups = [], detail = null, friends = [] }: Setup) {
  supabaseMock.from.mockImplementation(((table: string) => {
    if (table === 'profiles') {
      return queryBuilder({
        data: fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' }),
        error: null,
      });
    }
    const builder = queryBuilder<unknown>({ data: groups, error: null });
    // A single-group read (useGroup) ends in maybeSingle().
    builder.maybeSingle.mockResolvedValue({ data: detail, error: null });
    return builder;
  }) as never);
  supabaseMock.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'list_friends') {
      return { data: friends, error: null };
    }
    if (fn === 'create_group') {
      return { data: 'g-goa', error: null };
    }
    return { data: null, error: null };
  });
}

async function openApp() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  await render(<App />);
}

afterEach(() => {
  supabaseMock.rpc.mockReset();
  supabaseMock.from.mockReset();
});

describe('Groups list', () => {
  it('shows the empty state, which starts a new group', async () => {
    mockBackend({});
    await openApp();
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Start a new group' }),
    );
    expect(await screen.findByTestId('group-name')).toBeOnTheScreen();
  });

  it('lists groups with their member count', async () => {
    mockBackend({
      groups: [{ ...goaRow, group_members: [{ count: 3 }] }],
    });
    await openApp();
    expect(await screen.findByText('Goa trip')).toBeOnTheScreen();
    expect(screen.getByText('3 people')).toBeOnTheScreen();
    expect(screen.getByText('settled up')).toBeOnTheScreen();
  });
});

describe('Create group', () => {
  async function openCreate(friends: Friend[] = [asha, vik]) {
    mockBackend({ friends, detail: goaDetail() });
    await openApp();
    await fireEvent.press(await screen.findByTestId('groups-create'));
    await screen.findByTestId('group-name');
  }

  it('needs a name', async () => {
    await openCreate();
    await fireEvent.press(screen.getByTestId('group-create'));
    expect(await screen.findByText('Give your group a name')).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      'create_group',
      expect.anything(),
    );
  });

  it('creates the group with the chosen type and friends', async () => {
    await openCreate();
    await fireEvent.changeText(screen.getByTestId('group-name'), 'Goa trip');
    await fireEvent.press(screen.getByTestId('group-type-home'));
    await fireEvent.press(await screen.findByTestId('member-f-asha'));
    expect(
      screen.getByRole('button', { name: 'Create group with 2 people' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('group-create'));

    expect(supabaseMock.rpc).toHaveBeenCalledWith('create_group', {
      name: 'Goa trip',
      type: 'home',
      description: undefined,
      member_ids: ['f-asha'],
    });
    expect(await screen.findByText('Created Goa trip')).toBeOnTheScreen();
    // Lands on the new group.
    expect(await screen.findByText('No expenses yet')).toBeOnTheScreen();
  });

  it('adds someone by email and selects them', async () => {
    await openCreate([asha]);
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { status: 'invited', friend: vik },
      error: null,
    } as never);
    // After the invite the friends list includes Vikram.
    mockBackend({ friends: [asha, vik], detail: goaDetail() });

    await fireEvent.changeText(screen.getByTestId('group-name'), 'Goa trip');
    await fireEvent.press(screen.getByTestId('member-add-email'));
    await fireEvent.changeText(
      await screen.findByTestId('add-friend-email'),
      'vik@example.com',
    );
    await fireEvent.press(screen.getByTestId('add-friend-submit'));

    // Back on Create group, with Vikram ticked.
    expect(await screen.findByTestId('member-f-vik')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('group-create'));
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'create_group',
      expect.objectContaining({ member_ids: ['f-vik'] }),
    );
  });
});

describe('Group settings', () => {
  async function openSettings(createdBy: string) {
    mockBackend({
      groups: [
        { ...goaRow, created_by: createdBy, group_members: [{ count: 2 }] },
      ],
      detail: goaDetail(createdBy),
      friends: [asha],
    });
    await openApp();
    await fireEvent.press(await screen.findByTestId('group-g-goa'));
    await fireEvent.press(await screen.findByTestId('group-settings'));
    await screen.findByTestId('group-leave');
  }

  it('lets the admin add, remove and delete', async () => {
    await openSettings('user-1');
    expect(screen.getByTestId('group-add-people')).toBeOnTheScreen();
    expect(screen.getByTestId('group-remove-f-asha')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-remove-user-1')).toBeNull();
    expect(screen.getByTestId('group-delete')).toBeOnTheScreen();
    expect(screen.getByText('Admin')).toBeOnTheScreen();
  });

  it('a member can edit and leave, but not add, remove or delete', async () => {
    await openSettings('f-asha');
    expect(screen.queryByTestId('group-add-people')).toBeNull();
    expect(screen.queryByTestId('group-remove-f-asha')).toBeNull();
    expect(screen.queryByTestId('group-delete')).toBeNull();
    expect(screen.getByTestId('group-save')).toBeOnTheScreen();
  });

  it('removes a member after confirming', async () => {
    await openSettings('user-1');
    await fireEvent.press(screen.getByTestId('group-remove-f-asha'));
    const buttons = screen.getAllByRole('button', { name: 'Remove' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('remove_group_member', {
      gid: 'g-goa',
      member: 'f-asha',
    });
    expect(await screen.findByText('Removed Asha')).toBeOnTheScreen();
  });

  it.each([
    ['group-leave', 'Leave', 'leave_group', 'You left Goa trip'],
    ['group-delete', 'Delete', 'delete_group', 'Deleted Goa trip'],
  ])('%s confirms, then goes back to the list', async (id, label, fn, msg) => {
    await openSettings('user-1');
    await fireEvent.press(screen.getByTestId(id));
    const buttons = screen.getAllByRole('button', { name: label });
    // The group is gone from the list afterwards.
    mockBackend({ groups: [], friends: [asha] });
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(fn, { gid: 'g-goa' });
    expect(await screen.findByText(msg)).toBeOnTheScreen();
    expect(await screen.findByText('No groups yet')).toBeOnTheScreen();
  });

  it('shows the admin-only error from the server', async () => {
    await openSettings('user-1');
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '42501',
        hint: 'not_admin',
        message: 'Only the group admin can do that',
      },
    });
    await fireEvent.press(screen.getByTestId('group-delete'));
    const buttons = screen.getAllByRole('button', { name: 'Delete' });
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(
      await screen.findByText('Only the group admin can do that'),
    ).toBeOnTheScreen();
  });
});
