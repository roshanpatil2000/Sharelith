import { simplifyDebts } from '@/domain/simplify';
import type { GroupBalanceRow } from '@/features/expenses/api';

export type SuggestedPayment = {
  from: string;
  to: string;
  minor: number;
  currency: string;
};

/** Each member's nets, biggest first; settled members last. */
export function memberNets(rows: GroupBalanceRow[]) {
  const byUser = new Map<string, { currency: string; minor: number }[]>();
  for (const r of rows) {
    if (r.net_minor !== 0) {
      byUser.set(r.user_id, [
        ...(byUser.get(r.user_id) ?? []),
        { currency: r.currency, minor: r.net_minor },
      ]);
    }
  }
  return byUser;
}

/** The fewest payments that settle the whole group, per currency. */
export function suggestedPayments(rows: GroupBalanceRow[]): SuggestedPayment[] {
  const byCurrency = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const net = byCurrency.get(r.currency) ?? {};
    net[r.user_id] = r.net_minor;
    byCurrency.set(r.currency, net);
  }
  return [...byCurrency]
    .flatMap(([currency, net]) =>
      simplifyDebts(net).map(d => ({ ...d, currency })),
    )
    .sort((a, b) => b.minor - a.minor);
}
