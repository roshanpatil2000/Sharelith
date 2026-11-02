import { debtsForExpense, netByUser, settleNet } from '../balances';

describe('netByUser', () => {
  it('is paid minus owed, including people on only one side', () => {
    expect(netByUser({ a: 900 }, { a: 300, b: 300, c: 300 })).toEqual({
      a: 600,
      b: -300,
      c: -300,
    });
    expect(netByUser({ a: 100 }, { b: 100 })).toEqual({ a: 100, b: -100 });
  });
});

describe('debtsForExpense', () => {
  it('has everyone pay a single payer back', () => {
    expect(debtsForExpense({ a: 900 }, { a: 300, b: 300, c: 300 })).toEqual([
      { from: 'b', to: 'a', minor: 300 },
      { from: 'c', to: 'a', minor: 300 },
    ]);
  });

  it('spreads debts across several payers', () => {
    expect(
      debtsForExpense({ a: 600, b: 300 }, { a: 300, b: 300, c: 300 }),
    ).toEqual([{ from: 'c', to: 'a', minor: 300 }]);
    expect(debtsForExpense({ a: 500, b: 500 }, { c: 600, d: 400 })).toEqual([
      { from: 'c', to: 'a', minor: 500 },
      { from: 'c', to: 'b', minor: 100 },
      { from: 'd', to: 'b', minor: 400 },
    ]);
  });

  it('leaves no debts when everyone paid their own share', () => {
    expect(debtsForExpense({ a: 100, b: 100 }, { a: 100, b: 100 })).toEqual([]);
  });

  it('orders ids the way Postgres orders uuids', () => {
    const lower = '0a000000-0000-0000-0000-000000000000';
    const higher = 'f0000000-0000-0000-0000-000000000000';
    expect(settleNet({ [higher]: -5, [lower]: -5, c: 10 })[0]!.from).toBe(
      lower,
    );
  });

  it('accounts for the whole net, whatever the split', () => {
    const net = { a: 1000, b: -333, c: -333, d: -334 };
    const debts = settleNet(net);
    expect(debts.reduce((sum, debt) => sum + debt.minor, 0)).toBe(1000);
  });
});
