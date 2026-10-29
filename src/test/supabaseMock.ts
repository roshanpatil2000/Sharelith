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
    invited_by: null,
    joined_at: '2026-10-28T00:00:00Z',
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
    ...overrides,
  };
}

/** Chainable stand-in for supabase.from(...): select/update/eq resolve `result`. */
type QueryBuilder<T> = {
  select: jest.Mock<QueryBuilder<T>>;
  update: jest.Mock<QueryBuilder<T>>;
  eq: jest.Mock<QueryBuilder<T>>;
  single: jest.Mock<Promise<{ data: T; error: unknown }>>;
};

export function queryBuilder<T>(result: {
  data: T;
  error: unknown;
}): QueryBuilder<T> {
  const builder: QueryBuilder<T> = {
    select: jest.fn(() => builder),
    update: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    single: jest.fn(async () => result),
  };
  return builder;
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
