/**
 * Friend balances. Expenses arrive in Phase 4; until then everyone is
 * settled up, but screens and filters are built on this shape so Phase 4
 * only has to supply the data.
 */

/** Net per currency, in minor units: + they owe you, − you owe them. */
export type FriendBalance = { currency: string; minor: number }[];
export type BalancesById = Record<string, FriendBalance>;

export type FriendFilter = 'all' | 'owesYou' | 'youOwe';

/** Phase 4 replaces this with a query on the balances view. */
export function useFriendBalances(): BalancesById {
  return {};
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
