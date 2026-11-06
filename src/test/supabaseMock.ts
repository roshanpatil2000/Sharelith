import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/features/account/api';

type Listener = (event: string, session: Session | null) => void;
const listeners = new Set<Listener>();

/** Fires an auth change to every onAuthStateChange subscriber. */
export function emitAuth(event: string, session: Session | null) {
  listeners.forEach(l => l(event, session));
}

export function fakeSession(
  id = 'user-1',
  email = 'asha@example.com',
): Session {
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-10-28T00:00:00Z',
    },
  } as Session;
}

export function fakeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    full_name: 'Asha Rao',
    email: 'asha@example.com',
    phone: null,
    avatar_url: null,
    default_currency: 'INR',
    timezone: 'Asia/Kolkata',
    email_verified_at: null,
    deleted_at: null,
    invited_by: null,
    joined_at: '2026-10-28T00:00:00Z',
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

/**
 * Chainable stand-in for supabase.from(...): every chain resolves `result`,
 * whether it ends in single()/maybeSingle() or is awaited directly.
 */
type QueryBuilder<T> = {
  select: jest.Mock<QueryBuilder<T>>;
  update: jest.Mock<QueryBuilder<T>>;
  eq: jest.Mock<QueryBuilder<T>>;
  is: jest.Mock<QueryBuilder<T>>;
  order: jest.Mock<QueryBuilder<T>>;
  single: jest.Mock<Promise<{ data: T; error: unknown }>>;
  maybeSingle: jest.Mock<Promise<{ data: T; error: unknown }>>;
  then: Promise<{ data: T; error: unknown }>['then'];
};

/**
 * Serves `profiles` reads and get_my_profile from `builder`; every other table
 * (groups, …) reads as an empty list.
 */
export function mockProfiles<T>(builder: QueryBuilder<T>) {
  const others = supabaseMock.rpc.getMockImplementation();
  supabaseMock.rpc.mockImplementation(async (fn: string, args?: unknown) => {
    if (fn !== 'get_my_profile') {
      return others ? others(fn, args) : { data: null, error: null };
    }
    const { data, error } = await builder.single();
    return { data: data === null ? null : [data], error };
  });
  supabaseMock.from.mockImplementation(((table: string) =>
    table === 'profiles'
      ? builder
      : queryBuilder<unknown>({ data: [], error: null })) as never);
}

export function queryBuilder<T>(result: {
  data: T;
  error: unknown;
}): QueryBuilder<T> {
  const builder: QueryBuilder<T> = {
    select: jest.fn(() => builder),
    update: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    order: jest.fn(() => builder),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

type ChangeHandler = (payload: unknown) => void;

/** Stand-in for a realtime channel; emitRealtime() plays a change to it. */
type FakeChannel = {
  handlers: ChangeHandler[];
  on: jest.Mock<FakeChannel, [string, unknown, ChangeHandler]>;
  subscribe: jest.Mock<FakeChannel, []>;
};

/** Open channels only: removeChannel() takes one out, like the real client. */
const openChannels = new Set<FakeChannel>();

function fakeChannel(): FakeChannel {
  const channel: FakeChannel = {
    handlers: [],
    on: jest.fn((_type: string, _filter: unknown, handler: ChangeHandler) => {
      channel.handlers.push(handler);
      return channel;
    }),
    subscribe: jest.fn(() => channel),
  };
  openChannels.add(channel);
  return channel;
}

/** Delivers a postgres change to every open channel. */
export function emitRealtime(payload: unknown = {}) {
  openChannels.forEach(c => c.handlers.forEach(h => h(payload)));
}

export const supabaseMock = {
  auth: {
    getSession: jest.fn(async () => ({
      data: { session: null as Session | null },
      error: null,
    })),
    onAuthStateChange: jest.fn((cb: Listener) => {
      listeners.add(cb);
      return {
        data: { subscription: { unsubscribe: () => listeners.delete(cb) } },
      };
    }),
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(async () => {
      emitAuth('SIGNED_OUT', null);
      return { error: null };
    }),
    resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    setSession: jest.fn(),
    resend: jest.fn(async () => ({ data: {}, error: null })),
    updateUser: jest.fn(async () => ({ data: {}, error: null })),
    signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  },
  from: jest.fn(),
  functions: {
    invoke: jest.fn(async () => ({ data: null, error: null })),
  },
  rpc: jest.fn(
    async (
      _fn: string,
      _args?: unknown,
    ): Promise<{ data: unknown; error: unknown }> => ({
      data: null,
      error: null,
    }),
  ),
  channel: jest.fn((_name: string) => fakeChannel()),
  removeChannel: jest.fn(async (channel: FakeChannel) => {
    openChannels.delete(channel);
    return 'ok';
  }),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(async () => ({ data: {}, error: null })),
      remove: jest.fn(async () => ({ data: [], error: null })),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'https://example.com/avatar.jpg' },
      })),
    })),
  },
};
