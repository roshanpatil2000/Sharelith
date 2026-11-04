import { handleAddFriend, type AddFriendDeps } from '../addFriendHandler';
import { DAILY_ATTEMPT_LIMIT } from '../friends';

type Result = { data?: unknown; error?: unknown };

const request = (body: unknown) =>
  new Request('http://localhost/add-friend', {
    method: 'POST',
    body: JSON.stringify(body),
  });

/** Fake admin client; `calls` records every filter the handler applies. */
function setup({
  claim = { data: true, error: null } as Result,
  lookup = { data: null, error: null } as Result,
  insert = { error: null } as Result,
} = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const profileQuery = (result: Result) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'ilike', 'like']) {
      query[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return query;
      };
    }
    query.single = async () => ({
      data: { full_name: 'Asha' },
      error: null,
    });
    query.maybeSingle = async () => result;
    return query;
  };
  const rpc = jest.fn(async () => claim);
  const inviteUserByEmail = jest.fn(async () => ({
    data: { user: { id: 'new-user' } },
    error: null,
  }));
  const sendEmail = jest.fn(async () => []);
  const deps = {
    caller: {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'me', email: 'asha@example.com' } },
        }),
      },
    },
    admin: {
      rpc,
      auth: { admin: { inviteUserByEmail } },
      from: (table: string) =>
        table === 'profiles'
          ? profileQuery(lookup)
          : { insert: async () => insert },
    },
    inviteRedirectUrl: 'https://example.com/auth/callback?next=invite',
    sendEmail,
  } as unknown as AddFriendDeps;
  return { deps, calls, rpc, inviteUserByEmail, sendEmail };
}

describe('handleAddFriend', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each(['rosh%@gmail.com', 'john_doe@gmail.com', 'a*@gmail.com'])(
    'looks up %s exactly, never as a pattern',
    async email => {
      const { deps, calls } = setup();
      await handleAddFriend(request({ email }), deps);
      expect(calls).toContainEqual({ method: 'eq', args: ['email', email] });
      expect(calls.map(c => c.method)).not.toContain('ilike');
      expect(calls.map(c => c.method)).not.toContain('like');
    },
  );

  it('does not invite anyone when the lookup fails', async () => {
    const { deps, inviteUserByEmail } = setup({
      lookup: { data: null, error: { message: 'boom' } },
    });
    const res = await handleAddFriend(
      request({ email: 'ravi@example.com', name: 'Ravi' }),
      deps,
    );
    expect(res.status).toBe(503);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('claims an attempt before any lookup, even if nobody is added', async () => {
    const { deps, rpc } = setup();
    const res = await handleAddFriend(
      request({ email: 'ravi@example.com' }),
      deps,
    );
    expect(await res.json()).toEqual({ status: 'needs_name' });
    expect(rpc).toHaveBeenCalledWith('claim_friend_add_attempt', {
      uid: 'me',
      daily_limit: DAILY_ATTEMPT_LIMIT,
    });
  });

  it('stops at the limit without looking anyone up', async () => {
    const { deps, calls } = setup({ claim: { data: false, error: null } });
    const res = await handleAddFriend(
      request({ email: 'ravi@example.com' }),
      deps,
    );
    expect(res.status).toBe(429);
    expect(calls).toEqual([]);
  });

  it('fails closed when the limit check errors', async () => {
    const { deps, calls } = setup({
      claim: { data: null, error: { message: 'boom' } },
    });
    const res = await handleAddFriend(
      request({ email: 'ravi@example.com' }),
      deps,
    );
    expect(res.status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('adds an existing user and emails them', async () => {
    const { deps, sendEmail } = setup({
      lookup: {
        data: {
          id: 'ravi',
          full_name: 'Ravi',
          email: 'ravi@example.com',
          joined_at: '2026-10-29T00:00:00Z',
        },
        error: null,
      },
    });
    const res = await handleAddFriend(
      request({ email: 'ravi@example.com' }),
      deps,
    );
    expect((await res.json()).status).toBe('added');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('says so when they are already friends, without emailing again', async () => {
    const { deps, sendEmail } = setup({
      lookup: {
        data: {
          id: 'ravi',
          full_name: 'Ravi',
          email: 'ravi@example.com',
          joined_at: '2026-10-29T00:00:00Z',
        },
        error: null,
      },
      // The friendship's primary key already exists.
      insert: { error: { code: '23505', message: 'duplicate key' } },
    });
    const res = await handleAddFriend(
      request({ email: 'Ravi@Example.com' }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'already_friends',
      friend: { id: 'ravi', full_name: 'Ravi' },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('refuses to add yourself', async () => {
    const { deps, rpc } = setup();
    const res = await handleAddFriend(
      request({ email: 'ASHA@example.com' }),
      deps,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('self');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects other methods and signed-out callers', async () => {
    const { deps } = setup();
    const get = new Request('http://localhost/add-friend');
    expect((await handleAddFriend(get, deps)).status).toBe(405);

    const signedOut = {
      ...deps,
      caller: { auth: { getUser: async () => ({ data: { user: null } }) } },
    } as unknown as AddFriendDeps;
    const res = await handleAddFriend(request({ email: 'a@b.co' }), signedOut);
    expect(res.status).toBe(401);
  });
});
