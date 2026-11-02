import type { Debt } from './balances';
import type { Shares } from './split';

/**
 * Replaces a group's debts with fewer payments, for one currency: repeatedly
 * pays the biggest debtor to the biggest creditor. Everyone ends up with the
 * same net balance. Ties go by id, so the result is stable.
 */
export function simplifyDebts(net: Shares): Debt[] {
  const left = { ...net };
  const biggest = (sign: 1 | -1) =>
    Object.keys(left)
      .filter(id => left[id]! * sign > 0)
      .sort((a, b) => (left[b]! - left[a]!) * sign || (a < b ? -1 : 1))[0];

  const payments: Debt[] = [];
  for (;;) {
    const from = biggest(-1);
    const to = biggest(1);
    if (from === undefined || to === undefined) {
      return payments;
    }
    const minor = Math.min(-left[from]!, left[to]!);
    payments.push({ from, to, minor });
    left[from]! += minor;
    left[to]! -= minor;
  }
}
