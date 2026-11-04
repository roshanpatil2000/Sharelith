import { simplifyDebts } from '@/domain/simplify';
import type { BalanceRow, GroupBalanceRow } from './api';

/** One payment that would settle a balance. groupId null: outside groups. */
export type Settlement = {
  from: string;
  to: string;
  minor: number;
  currency: string;
  groupId: string | null;
};

export const settlementKey = (s: Settlement) =>
  `${s.groupId ?? 'none'}:${s.currency}:${s.from}:${s.to}`;

/** Biggest first, so the likeliest payment is preselected. */
const byAmount = (a: Settlement, b: Settlement) => b.minor - a.minor;

/** A balance with one person in one group and currency, as a payment. */
function fromBalance(row: BalanceRow, me: string): Settlement {
  return row.net_minor < 0
    ? {
        from: me,
        to: row.friend_id,
        minor: -row.net_minor,
        currency: row.currency,
        groupId: row.group_id,
      }
    : {
        from: row.friend_id,
        to: me,
        minor: row.net_minor,
        currency: row.currency,
        groupId: row.group_id,
      };
}

/** Everything between you and a friend, one payment per group and currency. */
export function friendSettlements(
  rows: BalanceRow[],
  me: string,
  friendId: string,
): Settlement[] {
  return rows
    .filter(r => r.friend_id === friendId && r.net_minor !== 0)
    .map(r => fromBalance(r, me))
    .sort(byAmount);
}

/**
 * Your payments in a group. With simplify on, from everyone's net (fewer
 * payments, possibly to someone you never shared an expense with); otherwise
 * straight from your balances with each person.
 */
export function groupSettlements(
  myRows: BalanceRow[],
  groupRows: GroupBalanceRow[] | undefined,
  me: string,
  groupId: string,
  simplify: boolean,
): Settlement[] {
  if (!simplify || !groupRows) {
    return myRows
      .filter(r => r.group_id === groupId && r.net_minor !== 0)
      .map(r => fromBalance(r, me))
      .sort(byAmount);
  }
  const byCurrency = new Map<string, Record<string, number>>();
  for (const row of groupRows) {
    const net = byCurrency.get(row.currency) ?? {};
    net[row.user_id] = row.net_minor;
    byCurrency.set(row.currency, net);
  }
  return [...byCurrency]
    .flatMap(([currency, net]) =>
      simplifyDebts(net)
        .filter(d => d.from === me || d.to === me)
        .map(d => ({ ...d, currency, groupId })),
    )
    .sort(byAmount);
}
