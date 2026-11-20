import {
  buildLoginEmail,
  clientIp,
  parseDevice,
  handleClaimSession,
  sessionIdOf,
  type ClaimSessionDeps,
} from '../claimSessionHandler';

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const jwt = (claims: unknown) => `h.${b64url(claims)}.s`;

const request = (body: unknown, token = jwt({ session_id: 'sess-new' })) =>
  new Request('http://localhost/claim-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    },
    body: JSON.stringify(body),
  });

function setup({ ended = 1, tokens = ['tok-new', 'tok-old'] } = {}) {
  const rpc = jest.fn(async () => ({ data: ended, error: null }));
  const deleted: string[][] = [];
  const from = jest.fn(() => ({
    select: () => ({
      eq: async () => ({ data: tokens.map(token => ({ token })), error: null }),
    }),
    delete: () => ({
      in: async (_col: string, list: string[]) => {
        deleted.push(list);
        return { error: null };
      },
    }),
  }));
  const send = jest.fn(async () => 'sent' as const);
  const sendEmail = jest.fn(async () => []);
  const locate = jest.fn(async () => 'Pune, Maharashtra, IN');
  const deps = {
    caller: {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'u1',
              email: 'asha@example.com',
              user_metadata: { full_name: 'Asha' },
            },
          },
        }),
      },
    },
    admin: { rpc, from },
    send,
    sendEmail,
    locate,
  } as unknown as ClaimSessionDeps;
  return { deps, rpc, send, sendEmail, locate, deleted };
}

it('reads the session id from an access token', () => {
  expect(sessionIdOf(`Bearer ${jwt({ session_id: 'abc' })}`)).toBe('abc');
  expect(sessionIdOf('Bearer nonsense')).toBeNull();
  expect(sessionIdOf(null)).toBeNull();
});

it('keeps this session, signs out the others, and tells them', async () => {
  const { deps, rpc, send, sendEmail, deleted } = setup();
  const res = await handleClaimSession(
    request({ push_token: 'tok-new' }),
    deps,
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ signed_out: 1 });
  expect(rpc).toHaveBeenCalledWith('end_other_sessions', {
    uid: 'u1',
    keep: 'sess-new',
  });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ token: 'tok-old', data: { type: 'signed_out' } }),
  );
  expect(deleted).toEqual([['tok-old']]);
  expect(sendEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: [{ email: 'asha@example.com', name: 'Asha' }],
    }),
  );
});

it('emails a sign-in alert every time, with device, IP and location', async () => {
  const { deps, send, sendEmail, locate } = setup({
    ended: 0,
    tokens: ['tok-new'],
  });
  await handleClaimSession(
    request({
      push_token: 'tok-new',
      device: {
        platform: 'android',
        model: 'Google Pixel 9',
        os: 'Android 16',
        app_version: '1.0.5',
      },
    }),
    deps,
  );
  expect(send).not.toHaveBeenCalled();
  expect(locate).toHaveBeenCalledWith('203.0.113.7');
  const email = (sendEmail.mock.calls[0] as unknown as [{ text: string }])[0];
  expect(email.text).toMatch(/Google Pixel 9, Android 16/);
  expect(email.text).toMatch(/203\.0\.113\.7/);
  expect(email.text).toMatch(/Pune, Maharashtra, IN/);
  expect(email.text).toMatch(/Sharelith 1\.0\.5/);
  expect(email.text).not.toMatch(/other devices were signed out/);
});

it('still emails when the location lookup fails', async () => {
  const { deps, sendEmail, locate } = setup({ ended: 0, tokens: [] });
  locate.mockRejectedValueOnce(new Error('timeout'));
  await handleClaimSession(request({}), deps);
  const email = (sendEmail.mock.calls[0] as unknown as [{ text: string }])[0];
  expect(email.text).toMatch(/Approximate location: Unknown/);
});

it('reads the first forwarded IP and cleans device fields', () => {
  expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe(
    '1.2.3.4',
  );
  expect(clientIp(new Headers())).toBeNull();
  expect(parseDevice({ model: ' x '.repeat(100), os: 5 })).toEqual({
    platform: undefined,
    model: expect.any(String),
    os: undefined,
    app_version: undefined,
  });
});

it('refuses callers without a session', async () => {
  const { deps, rpc } = setup();
  const res = await handleClaimSession(request({}, 'not-a-jwt'), deps);
  expect(res.status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

it('writes an email that says what happened and what to do', () => {
  const email = buildLoginEmail(
    { email: 'a@b.co' },
    {
      when: new Date(0),
      ip: null,
      location: null,
      device: { model: '<b>x</b>' },
      signedOut: 2,
    },
  );
  expect(email.subject).toMatch(/New sign-in/);
  expect(email.text).toMatch(/reset your password/);
  expect(email.text).toMatch(/other devices were signed out/);
  expect(email.html).not.toContain('<b>x</b>');
  expect(email.category).toBe('Security');
});
