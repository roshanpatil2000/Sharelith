import {
  handleSendPush,
  type FcmMessage,
  type FcmResult,
} from '../pushHandler';
import { formatMinor, pushText, type PushActivity } from '../pushText';

const activity = (over: Partial<PushActivity> = {}): PushActivity => ({
  kind: 'expense_added',
  actor_name: 'Asha Rao',
  group_name: 'Goa',
  description: 'Dinner',
  amount_minor: 120000,
  currency: 'INR',
  ...over,
});

describe('pushText', () => {
  it('formats with the currency’s decimals', () => {
    expect(formatMinor(125050, 'INR')).toBe('₹1,250.50');
    expect(formatMinor(500, 'JPY')).toBe('JP¥500');
  });

  it('says what an expense does to you', () => {
    expect(pushText(activity(), -40000)).toEqual({
      title: 'Dinner · Goa',
      body: 'Asha added it. You owe ₹400.00.',
    });
    expect(pushText(activity({ group_name: null }), 80000)).toEqual({
      title: 'Dinner',
      body: 'Asha added it. You get back ₹800.00.',
    });
    expect(pushText(activity({ kind: 'expense_updated' }), -100).body).toBe(
      'Asha updated it. Now: You owe ₹1.00.',
    );
    expect(pushText(activity({ kind: 'expense_deleted' }), -100).body).toBe(
      'Asha deleted it.',
    );
  });

  it('tells payer and payee apart', () => {
    const payment = activity({ kind: 'payment_added', amount_minor: 50000 });
    expect(pushText(payment, -50000).body).toBe('Asha paid you ₹500.00.');
    expect(pushText(payment, 50000).body).toBe(
      'Asha recorded that you paid them ₹500.00.',
    );
  });

  it('covers group membership', () => {
    expect(pushText(activity({ kind: 'member_added' }), 0)).toEqual({
      title: 'Goa',
      body: 'Asha added you to the group.',
    });
    expect(pushText(activity({ kind: 'member_removed' }), 0).body).toBe(
      'Asha removed you from the group.',
    );
  });
});

const SECRET = 's3cret';

function setup({
  row = {
    kind: 'expense_added',
    group_id: 'g1',
    expense_id: 'e1',
    group_name: 'Goa',
    description: 'Dinner',
    amount_minor: 1000,
    currency: 'INR',
    actor: { full_name: 'Asha' },
  } as unknown,
  tokens = [{ token: 't1' }, { token: 't2' }],
  results = { t1: 'sent', t2: 'gone' } as Record<string, FcmResult>,
} = {}) {
  const deleted: unknown[] = [];
  const sent: FcmMessage[] = [];
  const admin = {
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () =>
        table === 'push_tokens' ? Promise.resolve({ data: tokens }) : q;
      q.maybeSingle = async () => ({ data: row, error: null });
      q.delete = () => ({
        in: async (_c: string, values: unknown[]) => {
          deleted.push(...values);
          return { error: null };
        },
      });
      return q;
    },
  };
  const send = jest.fn(async (m: FcmMessage) => {
    sent.push(m);
    return results[m.token] ?? 'sent';
  });
  return {
    sent,
    deleted,
    call: (body: unknown, secret = SECRET) =>
      handleSendPush(
        new Request('http://localhost/send-push', {
          method: 'POST',
          headers: { 'x-push-secret': secret },
          body: JSON.stringify(body),
        }),
        { secret: SECRET, admin: admin as never, send },
      ),
  };
}

describe('handleSendPush', () => {
  const body = { activity_id: 7, user_id: 'u1', net_minor: -500 };

  it('refuses a wrong secret', async () => {
    const { call, sent } = setup();
    expect((await call(body, 'nope')).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('sends to every device and drops tokens FCM rejects', async () => {
    const { call, sent, deleted } = setup();
    const res = await call(body);
    expect(await res.json()).toEqual({ sent: 1, removed: 1 });
    expect(sent.map(m => m.token)).toEqual(['t1', 't2']);
    expect(sent[0].notification).toEqual({
      title: 'Dinner · Goa',
      body: 'Asha added it. You owe ₹5.00.',
    });
    expect(sent[0].data).toEqual({
      kind: 'expense_added',
      group_id: 'g1',
      expense_id: 'e1',
    });
    expect(deleted).toEqual(['t2']);
  });

  it('does not link to a deleted expense', async () => {
    const { call, sent } = setup({
      row: {
        kind: 'expense_deleted',
        group_id: null,
        expense_id: 'e1',
        description: 'Dinner',
        actor: null,
      },
    });
    await call(body);
    expect(sent[0].data).toEqual({ kind: 'expense_deleted' });
  });

  it('does nothing without devices', async () => {
    const { call, sent } = setup({ tokens: [] });
    expect(await (await call(body)).json()).toEqual({ sent: 0 });
    expect(sent).toHaveLength(0);
  });

  it('rejects a bad body', async () => {
    const { call } = setup();
    expect((await call({ activity_id: 'x' })).status).toBe(400);
  });
});
