import {
  filterFriends,
  overallBalance,
  sumBalances,
  type BalancesById,
} from '../balances';

const friends = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const balances: BalancesById = {
  a: [{ currency: 'INR', minor: 5000 }],
  b: [
    { currency: 'INR', minor: -2000 },
    { currency: 'USD', minor: 300 },
  ],
  c: [],
};

describe('overallBalance', () => {
  it('sums per currency and drops zero totals', () => {
    expect(overallBalance(balances)).toEqual([
      { currency: 'INR', minor: 3000 },
      { currency: 'USD', minor: 300 },
    ]);
    expect(
      overallBalance({
        a: [{ currency: 'INR', minor: 100 }],
        b: [{ currency: 'INR', minor: -100 }],
      }),
    ).toEqual([]);
  });

  it('is empty with no balances (Phase 2: everyone settled)', () => {
    expect(overallBalance({})).toEqual([]);
  });
});

describe('filterFriends', () => {
  it('all returns everyone', () => {
    expect(filterFriends(friends, balances, 'all')).toEqual(friends);
  });
  it('owesYou keeps friends with any positive balance', () => {
    expect(filterFriends(friends, balances, 'owesYou').map(f => f.id)).toEqual([
      'a',
      'b',
    ]);
  });
  it('youOwe keeps friends with any negative balance', () => {
    expect(filterFriends(friends, balances, 'youOwe').map(f => f.id)).toEqual([
      'b',
    ]);
  });
});

describe('sumBalances', () => {
  const row = (
    friend_id: string,
    group_id: string | null,
    net_minor: number,
  ) => ({
    friend_id,
    group_id,
    currency: 'INR',
    net_minor,
  });

  it('adds up a friend across groups', () => {
    const rows = [row('a', 'g1', 300), row('a', null, 200)];
    expect(sumBalances(rows, r => r.friend_id)).toEqual({
      a: [{ currency: 'INR', minor: 500 }],
    });
  });

  it('drops people whose debts cancel out', () => {
    const rows = [row('a', 'g1', 300), row('a', 'g2', -300)];
    expect(sumBalances(rows, r => r.friend_id)).toEqual({});
  });

  it('keeps currencies separate', () => {
    const rows = [
      row('a', null, 300),
      { ...row('a', null, -50), currency: 'USD' },
    ];
    expect(sumBalances(rows, r => r.friend_id).a).toHaveLength(2);
  });

  it('skips rows without a key, such as non-group expenses', () => {
    expect(sumBalances([row('a', null, 300)], r => r.group_id)).toEqual({});
  });
});
