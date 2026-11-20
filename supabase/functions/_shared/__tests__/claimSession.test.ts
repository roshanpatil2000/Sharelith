import {
  buildSignedOutElsewhereEmail,
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
    headers: { Authorization: `Bearer ${token}` },
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
  } as unknown as ClaimSessionDeps;
  return { deps, rpc, send, sendEmail, deleted };
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

it('sends no email when nothing else was signed in', async () => {
  const { deps, send, sendEmail } = setup({ ended: 0, tokens: ['tok-new'] });
  await handleClaimSession(request({ push_token: 'tok-new' }), deps);
  expect(send).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
});

it('refuses callers without a session', async () => {
  const { deps, rpc } = setup();
  const res = await handleClaimSession(request({}, 'not-a-jwt'), deps);
  expect(res.status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

it('writes an email that says what happened and what to do', () => {
  const email = buildSignedOutElsewhereEmail({ email: 'a@b.co' }, new Date(0));
  expect(email.subject).toMatch(/new device/);
  expect(email.text).toMatch(/reset your password/);
  expect(email.category).toBe('Security');
});
