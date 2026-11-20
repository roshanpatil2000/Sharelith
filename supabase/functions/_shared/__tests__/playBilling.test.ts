import {
  handleVerifyPurchase,
  type VerifyPurchaseDeps,
} from '../verifyPurchaseHandler';
import {
  handlePlayNotification,
  type PlayNotificationsDeps,
} from '../playNotificationsHandler';
import { toRow, type PlaySubscription } from '../playBilling';

const products = ['pro_monthly', 'pro_yearly'];
const active: PlaySubscription = {
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  lineItems: [{ productId: 'pro_monthly', expiryTime: '2026-12-20T00:00:00Z' }],
  externalAccountIdentifiers: { obfuscatedExternalAccountId: 'u1' },
};

/** Fake admin client over one in-memory subscriptions table. */
function fakeAdmin(
  rows: { user_id: string; purchase_token: string; status?: string }[] = [],
) {
  const table = [...rows] as Record<string, unknown>[];
  const admin = {
    table,
    rpc: jest.fn(async () => ({ data: true, error: null })),
    from: () => ({
      select: () => ({
        eq: (_c: string, token: string) => ({
          maybeSingle: async () => ({
            data: table.find(r => r.purchase_token === token) ?? null,
          }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        const i = table.findIndex(r => r.user_id === row.user_id);
        if (i >= 0) table[i] = { ...table[i], ...row };
        else table.push(row);
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_c: string, token: string) => {
          table
            .filter(r => r.purchase_token === token)
            .forEach(r => Object.assign(r, patch));
          return { error: null };
        },
      }),
    }),
  };
  return admin;
}

const play = (sub: PlaySubscription | null) => ({
  get: jest.fn(async () => sub),
  acknowledge: jest.fn(async () => {}),
});

const verifyReq = (body: unknown) =>
  new Request('http://x/verify-purchase', {
    method: 'POST',
    body: JSON.stringify(body),
  });

function verifyDeps(
  admin: ReturnType<typeof fakeAdmin>,
  api: ReturnType<typeof play>,
  user = 'u1',
) {
  return {
    caller: {
      auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    },
    admin,
    play: api,
    products,
  } as unknown as VerifyPurchaseDeps;
}

describe('toRow', () => {
  it('maps Play states and ignores products that aren’t ours', () => {
    expect(toRow(active, products)).toEqual({
      product_id: 'pro_monthly',
      status: 'active',
      expires_at: '2026-12-20T00:00:00Z',
    });
    expect(
      toRow(
        { ...active, subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' },
        products,
      )?.status,
    ).toBe('grace');
    expect(
      toRow(
        { ...active, subscriptionState: 'SUBSCRIPTION_STATE_PENDING' },
        products,
      ),
    ).toBeNull();
    expect(
      toRow(
        { ...active, lineItems: [{ productId: 'other', expiryTime: 'x' }] },
        products,
      ),
    ).toBeNull();
  });
});

describe('verify-purchase', () => {
  it('saves a valid purchase, acknowledges it, and reports Pro', async () => {
    const admin = fakeAdmin();
    const api = play(active);
    const res = await handleVerifyPurchase(
      verifyReq({ purchase_token: 'tok' }),
      verifyDeps(admin, api),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ is_pro: true, status: 'active' });
    expect(admin.table).toEqual([
      expect.objectContaining({
        user_id: 'u1',
        purchase_token: 'tok',
        product_id: 'pro_monthly',
      }),
    ]);
    expect(api.acknowledge).toHaveBeenCalledWith('pro_monthly', 'tok');
  });

  it('refuses tokens Google doesn’t know', async () => {
    const res = await handleVerifyPurchase(
      verifyReq({ purchase_token: 'tok' }),
      verifyDeps(fakeAdmin(), play(null)),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a purchase made from another account', async () => {
    const res = await handleVerifyPurchase(
      verifyReq({ purchase_token: 'tok' }),
      verifyDeps(fakeAdmin(), play(active), 'u2'),
    );
    expect(res.status).toBe(409);
  });

  it('refuses a token already saved for someone else', async () => {
    const sub = { ...active, externalAccountIdentifiers: {} };
    const admin = fakeAdmin([{ user_id: 'u9', purchase_token: 'tok' }]);
    const res = await handleVerifyPurchase(
      verifyReq({ purchase_token: 'tok' }),
      verifyDeps(admin, play(sub)),
    );
    expect(res.status).toBe(409);
  });

  it('needs a token', async () => {
    const res = await handleVerifyPurchase(
      verifyReq({}),
      verifyDeps(fakeAdmin(), play(active)),
    );
    expect(res.status).toBe(400);
  });
});

describe('play-notifications', () => {
  const notify = (token: string | undefined, secret = 's3cret') =>
    new Request(`http://x/play-notifications?secret=${secret}`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          data: btoa(
            JSON.stringify({
              subscriptionNotification: token
                ? { purchaseToken: token }
                : undefined,
            }),
          ),
        },
      }),
    });
  const deps = (
    admin: ReturnType<typeof fakeAdmin>,
    api: ReturnType<typeof play>,
  ) =>
    ({
      secret: 's3cret',
      admin,
      play: api,
      products,
    } as unknown as PlayNotificationsDeps);

  it('refuses calls without the secret', async () => {
    const res = await handlePlayNotification(
      notify('tok', 'wrong'),
      deps(fakeAdmin(), play(active)),
    );
    expect(res.status).toBe(403);
  });

  it('updates the row from Google’s current state (a cancellation)', async () => {
    const admin = fakeAdmin([
      { user_id: 'u1', purchase_token: 'tok', status: 'active' },
    ]);
    const sub = { ...active, subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' };
    await handlePlayNotification(notify('tok'), deps(admin, play(sub)));
    expect(admin.table[0]).toMatchObject({ status: 'canceled' });
  });

  it('expires the row when Google no longer knows the token (refund/revoke)', async () => {
    const admin = fakeAdmin([
      { user_id: 'u1', purchase_token: 'tok', status: 'active' },
    ]);
    await handlePlayNotification(notify('tok'), deps(admin, play(null)));
    expect(admin.table[0]).toMatchObject({ status: 'expired' });
  });

  it('saves a renewal for a purchase the app never verified, using the account id', async () => {
    const admin = fakeAdmin();
    await handlePlayNotification(notify('tok'), deps(admin, play(active)));
    expect(admin.table[0]).toMatchObject({ user_id: 'u1', status: 'active' });
  });

  it('ignores test notifications', async () => {
    const api = play(active);
    const res = await handlePlayNotification(
      notify(undefined),
      deps(fakeAdmin(), api),
    );
    expect(res.status).toBe(200);
    expect(api.get).not.toHaveBeenCalled();
  });
});
