import { filterFriends, overallBalance, type BalancesById } from '../balances';

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
