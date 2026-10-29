import React from 'react';
import { AmountText, Stack, Text } from '@/components';
import type { FriendBalance } from '../balances';

/** Trailing balance on a friend row: "owes you ₹200" / "you owe" / settled. */
export function FriendBalanceText({ balance }: { balance: FriendBalance }) {
  const nonZero = balance.filter(b => b.minor !== 0);
  if (nonZero.length === 0) {
    return (
      <Text variant="caption" color="neutral">
        settled up
      </Text>
    );
  }
  return (
    <Stack align="flex-end" gap="xxs">
      {nonZero.map(b => (
        <Stack key={b.currency} align="flex-end">
          <Text variant="caption" color={b.minor > 0 ? 'positive' : 'negative'}>
            {b.minor > 0 ? 'owes you' : 'you owe'}
          </Text>
          <AmountText minor={b.minor} currency={b.currency} />
        </Stack>
      ))}
    </Stack>
  );
}
