/**
 * Group balances. Expenses arrive in Phase 4; until then every group is
 * settled up, but screens use this shape so Phase 4 only supplies the data.
 */
import type { BalancesById, FriendBalance } from '@/features/friends/balances';

/** Your net in each group, per currency: + you're owed, − you owe. */
export type GroupBalance = FriendBalance;

/** Phase 4 replaces this with a query on the balances view. */
export function useGroupBalances(): BalancesById {
  return {};
}
