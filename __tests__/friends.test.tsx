import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import Contacts from 'react-native-contacts';
import App from '../App';
import {
  fakeProfile,
  fakeSession,
  mockProfiles,
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

function mockRpc(friends: Friend[]) {
  supabaseMock.rpc.mockImplementation(async (fn: string) =>
    fn === 'list_friends'
      ? { data: friends, error: null }
      : { data: null, error: null },
  );
}

async function openFriends() {
  supabaseMock.auth.getSession.mockResolvedValueOnce({
    data: { session: fakeSession() },
    error: null,
  });
  mockProfiles(
    queryBuilder({
      data: fakeProfile({ email_verified_at: '2026-10-28T00:00:00Z' }),
      error: null,
    }),
  );
  await render(<App />);
  await fireEvent.press(await screen.findByRole('button', { name: /Friends/ }));
}

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status }));

afterEach(() => supabaseMock.rpc.mockReset());

describe('Friends list', () => {
  it('shows an empty state with a way to add friends', async () => {
    mockRpc([]);
    await openFriends();
    expect(await screen.findByText('No friends yet')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Add friends' }),
    ).toBeOnTheScreen();
  });

  it('lists friends, marks invited ones, and shows settled up', async () => {
    mockRpc([asha, vik]);
    await openFriends();
    expect(await screen.findByText('Asha Rao')).toBeOnTheScreen();
    expect(screen.getByText('Vikram Shah')).toBeOnTheScreen();
    expect(screen.getByText('Invited · hasn’t joined yet')).toBeOnTheScreen();
    expect(screen.getAllByText('settled up')).toHaveLength(2);
  });

  it('filters: nobody owes you while everyone is settled', async () => {
    mockRpc([asha]);
    await openFriends();
    await screen.findByText('Asha Rao');
    await fireEvent.press(screen.getByRole('tab', { name: 'Owes you' }));
    expect(await screen.findByText('Nobody owes you')).toBeOnTheScreen();
    expect(screen.queryByText('Asha Rao')).toBeNull();
  });
});

describe('Add friend', () => {
  async function openAdd() {
    mockRpc([]);
    await openFriends();
    await fireEvent.press(await screen.findByTestId('friends-add'));
    await screen.findByTestId('add-friend-email');
  }

  it('validates the email before calling the server', async () => {
    await openAdd();
    await fireEvent.changeText(screen.getByTestId('add-friend-email'), 'nope');
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeOnTheScreen();
    expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
  });

  it('adds an existing user', async () => {
    await openAdd();
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { status: 'added', friend: asha },
      error: null,
    } as never);
    await fireEvent.changeText(
      screen.getByTestId('add-friend-email'),
      'Asha@Example.com',
    );
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('add-friend', {
      body: { email: 'Asha@Example.com', name: undefined },
    });
    expect(await screen.findByText('Added Asha')).toBeOnTheScreen();
  });

  it('says when they are already a friend, without a second entry', async () => {
    mockRpc([asha]);
    await openFriends();
    await screen.findByText('Asha Rao');
    await fireEvent.press(screen.getByTestId('friends-add'));
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: { status: 'already_friends', friend: asha },
      error: null,
    } as never);
    await fireEvent.changeText(
      await screen.findByTestId('add-friend-email'),
      'asha@example.com',
    );
    await fireEvent.press(screen.getByTestId('add-friend-submit'));

    expect(
      await screen.findByText('Asha is already your friend'),
    ).toBeOnTheScreen();
    expect(screen.getAllByText('Asha Rao')).toHaveLength(1);
  });

  it('asks for a name, then sends an invite', async () => {
    await openAdd();
    supabaseMock.functions.invoke
      .mockResolvedValueOnce({
        data: { status: 'needs_name' },
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: { status: 'invited', friend: vik },
        error: null,
      } as never);
    await fireEvent.changeText(
      screen.getByTestId('add-friend-email'),
      'vik@example.com',
    );
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    const name = await screen.findByTestId('add-friend-name');

    // Name is required for an invite.
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    expect(await screen.findByText('Enter their name')).toBeOnTheScreen();

    await fireEvent.changeText(name, 'Vikram Shah');
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    expect(supabaseMock.functions.invoke).toHaveBeenLastCalledWith(
      'add-friend',
      { body: { email: 'vik@example.com', name: 'Vikram Shah' } },
    );
    expect(
      await screen.findByText('Invited Vikram — they’ll get an email'),
    ).toBeOnTheScreen();
  });

  it.each([
    [400, { code: 'self', message: 'You can’t add yourself as a friend' }],
    [
      429,
      {
        code: 'rate_limited',
        message: 'You’ve added a lot of friends today. Try again tomorrow.',
      },
    ],
  ])('shows the server error (%s)', async (status, error) => {
    await openAdd();
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(status, { error }),
    } as never);
    await fireEvent.changeText(
      screen.getByTestId('add-friend-email'),
      'asha@example.com',
    );
    await fireEvent.press(screen.getByTestId('add-friend-submit'));
    expect(await screen.findByText(error.message)).toBeOnTheScreen();
  });
});

describe('Contacts and invite links', () => {
  async function openAdd() {
    mockRpc([]);
    await openFriends();
    await fireEvent.press(await screen.findByTestId('friends-add'));
    await screen.findByTestId('add-friend-email');
  }

  it('fills in a contact and invites them with their name', async () => {
    jest.mocked(Contacts.getAllWithoutPhotos).mockResolvedValueOnce([
      {
        recordID: '1',
        displayName: 'Neha Joshi',
        emailAddresses: [{ email: 'neha@example.com' }],
      },
      { recordID: '2', displayName: 'Ravi', emailAddresses: [] },
    ] as never);
    await openAdd();
    await fireEvent.press(screen.getByTestId('add-friend-contacts'));
    await fireEvent.press(
      await screen.findByTestId('contact-neha@example.com'),
    );
    expect(screen.queryByText('Ravi')).toBeNull();
    supabaseMock.functions.invoke.mockResolvedValueOnce({
      data: {
        status: 'invited',
        friend: { ...vik, full_name: 'Neha Joshi', email: 'neha@example.com' },
      },
      error: null,
    } as never);
    await fireEvent.press(await screen.findByTestId('add-friend-submit'));
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('add-friend', {
      body: { email: 'neha@example.com', name: 'Neha Joshi' },
    });
    expect(
      await screen.findByText('Invited Neha — they’ll get an email'),
    ).toBeOnTheScreen();
  });

  it('shows a QR code and link to share', async () => {
    await openAdd();
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'create_invite_link'
        ? { data: 'AbC-123_xyzQWERTYuiop', error: null }
        : { data: [], error: null },
    );
    await fireEvent.press(screen.getByTestId('add-friend-invite'));
    expect(await screen.findByTestId('qr-code')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'https://sharelith.techbeas.co.in/invite/AbC-123_xyzQWERTYuiop',
      ),
    ).toBeOnTheScreen();
  });
});

describe('Search', () => {
  it('finds friends by name and expenses from the server', async () => {
    supabaseMock.rpc.mockImplementation(async (fn: string) =>
      fn === 'list_friends'
        ? { data: [asha, vik], error: null }
        : fn === 'search_expenses'
        ? {
            data: [
              {
                id: 'e-9',
                group_id: null,
                description: 'Rao family dinner',
                amount_minor: 120000,
                currency: 'INR',
                category: 'food',
                expense_date: '2026-11-20',
                is_payment: false,
                created_by: 'f-asha',
                paid_by: 'f-asha',
                paid_to: null,
                payer_count: 1,
                my_net_minor: -60000,
              },
            ],
            error: null,
          }
        : { data: [], error: null },
    );
    await openFriends();
    await fireEvent.press(await screen.findByTestId('open-search'));
    await fireEvent.changeText(
      await screen.findByTestId('search-input'),
      'rao',
    );
    expect(await screen.findByTestId('search-friend-f-asha')).toBeOnTheScreen();
    expect(screen.queryByTestId('search-friend-f-vik')).toBeNull();
    expect(await screen.findByText('Rao family dinner')).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('search_expenses', {
      q: 'rao',
    });
  });

  it('waits for two letters before searching', async () => {
    mockRpc([asha]);
    await openFriends();
    await fireEvent.press(await screen.findByTestId('open-search'));
    await fireEvent.changeText(await screen.findByTestId('search-input'), 'a');
    expect(screen.getByText('Search Sharelith')).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      'search_expenses',
      expect.anything(),
    );
  });
});

describe('Friend detail', () => {
  it('shows the friend and removes them after confirming', async () => {
    mockRpc([asha]);
    await openFriends();
    await fireEvent.press(await screen.findByTestId('friend-f-asha'));
    expect(await screen.findByText('asha@example.com')).toBeOnTheScreen();
    expect(await screen.findByText('No expenses yet')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('friend-remove'));
    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    mockRpc([]);
    await fireEvent.press(removeButtons[removeButtons.length - 1]!);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('remove_friend', {
      friend: 'f-asha',
    });
    expect(await screen.findByText('Removed Asha')).toBeOnTheScreen();
  });
});
