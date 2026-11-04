import { useMemo } from 'react';
import { useBalances, type BalanceRow } from '@/features/expenses/api';

/** Net per currency, in minor units: + they owe you, − you owe them. */
export type FriendBalance = { currency: string; minor: number }[];
export type BalancesById = Record<string, FriendBalance>;

export type FriendFilter = 'all' | 'owesYou' | 'youOwe';

/** Adds rows up per key and currency, dropping totals of zero. */
export function sumBalances(
  rows: BalanceRow[],
  keyOf: (row: BalanceRow) => string | null,
): BalancesById {
  const totals = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key !== null) {
      const perCurrency = totals.get(key) ?? new Map<string, number>();
      perCurrency.set(
        row.currency,
        (perCurrency.get(row.currency) ?? 0) + row.net_minor,
      );
      totals.set(key, perCurrency);
    }
  }
  const result: BalancesById = {};
  for (const [key, perCurrency] of totals) {
    const balance = [...perCurrency]
      .filter(([, minor]) => minor !== 0)
      .map(([currency, minor]) => ({ currency, minor }));
    if (balance.length > 0) {
      result[key] = balance;
    }
  }
  return result;
}

/** Across every group, a friend's debts in one currency can cancel out. */
export function useFriendBalances(): BalancesById {
  const { data } = useBalances();
  return useMemo(() => sumBalances(data ?? [], r => r.friend_id), [data]);
}

/** Sums every friend's balance per currency (zero totals dropped). */
export function overallBalance(balances: BalancesById): FriendBalance {
  const totals = new Map<string, number>();
  for (const perFriend of Object.values(balances)) {
    for (const { currency, minor } of perFriend) {
      totals.set(currency, (totals.get(currency) ?? 0) + minor);
    }
  }
  return [...totals]
    .filter(([, minor]) => minor !== 0)
    .map(([currency, minor]) => ({ currency, minor }));
}

export function filterFriends<T extends { id: string }>(
  friends: T[],
  balances: BalancesById,
  filter: FriendFilter,
): T[] {
  if (filter === 'all') {
    return friends;
  }
  return friends.filter(f =>
    (balances[f.id] ?? []).some(b =>
      filter === 'owesYou' ? b.minor > 0 : b.minor < 0,
    ),
  );
}
