import { storage } from '@/lib/storage';
import { supabaseMock } from '@/test/supabaseMock';
import { claimSession, sessionIdOf } from '../singleDevice';

jest.mock('@/lib/supabase', () => ({
  supabase: require('@/test/supabaseMock').supabaseMock,
}));
jest.mock('@/features/push/push', () => ({
  currentPushToken: jest.fn(async () => 'tok'),
}));

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]+$/, '');
const token = (id: string) => `h.${b64url({ session_id: id })}.s`;

beforeEach(() => storage.remove('auth.claimedSession'));

it('reads the session id', () => {
  expect(sessionIdOf(token('s1'))).toBe('s1');
  expect(sessionIdOf('bad')).toBeNull();
});

it('claims each new session once, with this device’s push token', async () => {
  const invoke = jest.fn(async () => ({ data: {}, error: null }));
  (supabaseMock as unknown as { functions: unknown }).functions = { invoke };
  await claimSession(token('s1'));
  await claimSession(token('s1'));
  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith('claim-session', {
    body: {
      push_token: 'tok',
      device: expect.objectContaining({ platform: 'ios' }),
    },
  });
  await claimSession(token('s2'));
  expect(invoke).toHaveBeenCalledTimes(2);
});

it('tries again next time if the call failed', async () => {
  const invoke = jest
    .fn()
    .mockResolvedValueOnce({ data: null, error: new Error('offline') })
    .mockResolvedValue({ data: {}, error: null });
  (supabaseMock as unknown as { functions: unknown }).functions = { invoke };
  await claimSession(token('s3'));
  await claimSession(token('s3'));
  expect(invoke).toHaveBeenCalledTimes(2);
});
