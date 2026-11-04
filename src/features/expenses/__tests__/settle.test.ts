import { friendSettlements, groupSettlements } from '../settle';

const me = 'a';

describe('friendSettlements', () => {
  it('makes one payment per group and currency, biggest first', () => {
    expect(
      friendSettlements(
        [
          { friend_id: 'b', group_id: null, currency: 'INR', net_minor: -500 },
          { friend_id: 'b', group_id: 'g', currency: 'INR', net_minor: 2000 },
          { friend_id: 'c', group_id: 'g', currency: 'INR', net_minor: -900 },
          { friend_id: 'b', group_id: 'g', currency: 'USD', net_minor: 0 },
        ],
        me,
        'b',
      ),
    ).toEqual([
      { from: 'b', to: me, minor: 2000, currency: 'INR', groupId: 'g' },
      { from: me, to: 'b', minor: 500, currency: 'INR', groupId: null },
    ]);
  });
});

describe('groupSettlements', () => {
  const myRows = [
    { friend_id: 'b', group_id: 'g', currency: 'INR', net_minor: -1000 },
    { friend_id: 'c', group_id: 'g', currency: 'INR', net_minor: 1000 },
    { friend_id: 'b', group_id: null, currency: 'INR', net_minor: -50 },
  ];

  it('pays each person back directly when simplify is off', () => {
    expect(groupSettlements(myRows, undefined, me, 'g', false)).toEqual([
      { from: me, to: 'b', minor: 1000, currency: 'INR', groupId: 'g' },
      { from: 'c', to: me, minor: 1000, currency: 'INR', groupId: 'g' },
    ]);
  });

  it('suggests only your part of the simplified payments', () => {
    // C owes A and A owes B the same amount: simplified, C pays B and A is
    // already square.
    const everyone = [
      { user_id: 'b', currency: 'INR', net_minor: 1000 },
      { user_id: 'c', currency: 'INR', net_minor: -1000 },
    ];
    expect(groupSettlements(myRows, everyone, me, 'g', true)).toEqual([]);

    const withMe = [
      { user_id: 'a', currency: 'INR', net_minor: -300 },
      { user_id: 'b', currency: 'INR', net_minor: 1000 },
      { user_id: 'c', currency: 'INR', net_minor: -700 },
    ];
    expect(groupSettlements(myRows, withMe, me, 'g', true)).toEqual([
      { from: me, to: 'b', minor: 300, currency: 'INR', groupId: 'g' },
    ]);
  });
});
