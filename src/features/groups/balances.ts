import { useMemo } from 'react';
import { useBalances } from '@/features/expenses/api';
import {
  sumBalances,
  type BalancesById,
  type FriendBalance,
} from '@/features/friends/balances';

/** Your net in each group, per currency: + you're owed, − you owe. */
export type GroupBalance = FriendBalance;

export function useGroupBalances(): BalancesById {
  const { data } = useBalances();
  return useMemo(() => sumBalances(data ?? [], r => r.group_id), [data]);
}
