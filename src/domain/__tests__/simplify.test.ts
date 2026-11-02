import { netByUser } from '../balances';
import { simplifyDebts } from '../simplify';

const applied = (payments: { from: string; to: string; minor: number }[]) => {
  const net: Record<string, number> = {};
  for (const { from, to, minor } of payments) {
    net[from] = (net[from] ?? 0) - minor;
    net[to] = (net[to] ?? 0) + minor;
  }
  return net;
};

describe('simplifyDebts', () => {
  it('collapses a chain into one payment', () => {
    expect(simplifyDebts({ a: 100, b: 0, c: -100 })).toEqual([
      { from: 'c', to: 'a', minor: 100 },
    ]);
  });

  it('pays biggest debtor to biggest creditor first', () => {
    expect(simplifyDebts({ a: 500, b: 100, c: -400, d: -200 })).toEqual([
      { from: 'c', to: 'a', minor: 400 },
      { from: 'd', to: 'a', minor: 100 },
      { from: 'd', to: 'b', minor: 100 },
    ]);
  });

  it('does nothing when everyone is settled', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('keeps everyone’s balance exactly the same', () => {
    const net = netByUser(
      { a: 7001, b: 1999, c: 0 },
      { a: 3000, b: 3000, c: 3000 },
    );
    const payments = simplifyDebts(net);
    const result = applied(payments);
    for (const id of Object.keys(net)) {
      expect((result[id] ?? 0) + 0).toBe(net[id]! + 0);
    }
  });

  it('never needs more payments than people minus one', () => {
    const net = { a: 50, b: 30, c: 20, d: -40, e: -35, f: -25 };
    expect(simplifyDebts(net).length).toBeLessThanOrEqual(5);
  });

  it('does not change its input', () => {
    const net = { a: 10, b: -10 };
    simplifyDebts(net);
    expect(net).toEqual({ a: 10, b: -10 });
  });
});
