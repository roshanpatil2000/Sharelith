import {
  handleSmsInvite,
  normalizePhone,
  type SmsInviteDeps,
} from '../smsInviteHandler';
import { DAILY_ATTEMPT_LIMIT } from '../friends';

type Result = { data?: unknown; error?: unknown };

const request = (body: unknown, method = 'POST') =>
  new Request('http://localhost/invite-by-sms', {
    method,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });

function setup({
  user = { id: 'me' } as { id: string } | null,
  claim = { data: true, error: null } as Result,
  link = { data: 'AbC-123_xyzQWERTYuiop', error: null } as Result,
  smsError = null as null | { code: number | null; message: string },
} = {}) {
  const adminRpc = jest.fn(async () => claim);
  const callerRpc = jest.fn(async () => link);
  const sendSms = jest.fn(async () => {
    if (smsError) {
      throw Object.assign(new Error(smsError.message), smsError);
    }
    return 'SM1';
  });
  const deps = {
    caller: {
      auth: { getUser: async () => ({ data: { user } }) },
      rpc: callerRpc,
    },
    admin: {
      rpc: adminRpc,
      from: () => {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = () => q;
        q.single = async () => ({
          data: { full_name: 'Asha Rao' },
          error: null,
        });
        return q;
      },
    },
    sendSms,
  } as unknown as SmsInviteDeps;
  return { deps, adminRpc, callerRpc, sendSms };
}

describe('normalizePhone', () => {
  it.each([
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['+1 (555) 123-4567', '+15551234567'],
    ['0044 20 7946 0958', '+442079460958'],
  ])('%s → %s', (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it.each(['', '12345', 'abc', '+0123456789', null, 42])(
    'rejects %p',
    input => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe('handleSmsInvite', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('texts the invite link and counts it against the daily limit', async () => {
    const { deps, adminRpc, callerRpc, sendSms } = setup();
    const res = await handleSmsInvite(request({ phone: '98765 43210' }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'sent',
      link: 'https://sharelith.techbeas.co.in/invite/AbC-123_xyzQWERTYuiop',
    });
    expect(adminRpc).toHaveBeenCalledWith('claim_friend_add_attempt', {
      uid: 'me',
      daily_limit: DAILY_ATTEMPT_LIMIT,
    });
    expect(callerRpc).toHaveBeenCalledWith('create_invite_link', {});
    expect(sendSms).toHaveBeenCalledWith({
      to: '+919876543210',
      body: 'Asha Rao invited you to split costs on Sharelith: https://sharelith.techbeas.co.in/invite/AbC-123_xyzQWERTYuiop',
    });
  });

  it('needs a signed-in user', async () => {
    const { deps, sendSms } = setup({ user: null });
    const res = await handleSmsInvite(request({ phone: '9876543210' }), deps);
    expect(res.status).toBe(401);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('rejects other methods and bad numbers before counting', async () => {
    const { deps, adminRpc } = setup();
    expect((await handleSmsInvite(request({}, 'GET'), deps)).status).toBe(405);
    const res = await handleSmsInvite(request({ phone: '123' }), deps);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_phone');
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it('stops at the daily limit', async () => {
    const { deps, sendSms } = setup({ claim: { data: false, error: null } });
    const res = await handleSmsInvite(request({ phone: '9876543210' }), deps);
    expect(res.status).toBe(429);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('sends nothing if the invite link fails', async () => {
    const { deps, sendSms } = setup({
      link: { data: null, error: { message: 'boom' } },
    });
    const res = await handleSmsInvite(request({ phone: '9876543210' }), deps);
    expect(res.status).toBe(503);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it.each([
    [21608, 422, 'unverified_number'],
    [21614, 422, 'unreachable'],
    [null, 502, 'sms_failed'],
  ])('maps Twilio error %p to %p %s', async (code, status, appCode) => {
    const { deps } = setup({ smsError: { code, message: 'nope' } });
    const res = await handleSmsInvite(request({ phone: '9876543210' }), deps);
    expect(res.status).toBe(status);
    expect((await res.json()).error.code).toBe(appCode);
  });

  it('keeps the number out of the logs', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { deps } = setup({
      smsError: { code: 21608, message: 'unverified' },
    });
    await handleSmsInvite(request({ phone: '9876543210' }), deps);
    expect(JSON.stringify(log.mock.calls)).not.toContain('9876543210');
  });
});
