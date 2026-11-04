/**
 * Who owes whom. debtsForExpense must stay in step with
 * public.compute_expense_debts in the expenses migration.
 */
import type { Shares } from './split';

export type Debt = { from: string; to: string; minor: number };

/** Paid minus owed, per person: + is owed money, − owes money. */
export function netByUser(paid: Shares, owed: Shares): Shares {
  const net: Shares = {};
  for (const id of new Set([...Object.keys(paid), ...Object.keys(owed)])) {
    net[id] = (paid[id] ?? 0) - (owed[id] ?? 0);
  }
  return net;
}

/**
 * Pairs debtors with creditors, both in id order, which works for any number
 * of payers. Sorted by plain comparison to match Postgres' uuid ordering.
 */
export function settleNet(net: Shares): Debt[] {
  const inOrder = Object.keys(net).sort((a, b) => (a < b ? -1 : 1));
  const debtors = inOrder
    .filter(id => net[id]! < 0)
    .map(id => ({ id, left: -net[id]! }));
  const creditors = inOrder
    .filter(id => net[id]! > 0)
    .map(id => ({ id, left: net[id]! }));

  const debts: Debt[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!;
    const creditor = creditors[c]!;
    const minor = Math.min(debtor.left, creditor.left);
    debts.push({ from: debtor.id, to: creditor.id, minor });
    debtor.left -= minor;
    creditor.left -= minor;
    if (debtor.left === 0) {
      d++;
    }
    if (creditor.left === 0) {
      c++;
    }
  }
  return debts;
}

export function debtsForExpense(paid: Shares, owed: Shares): Debt[] {
  return settleNet(netByUser(paid, owed));
}
