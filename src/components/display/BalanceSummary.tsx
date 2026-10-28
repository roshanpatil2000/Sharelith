import React from 'react';
import { formatMoney } from '@/domain/money';
import { Stack } from '../primitives/Box';
import { Text } from '../primitives/Text';
import { amountTone } from './AmountText';

type Props = {
  /** Net balance per currency in minor units: + you are owed, − you owe. */
  balances: { currency: string; minor: number }[];
  /** "Overall" (friends tab) or a friend/group name. */
  subject?: string;
};

/**
 * "Overall, you are owed ₹1,200.00" / "you owe $20.00" / "You are all settled up".
 * One line per currency, matching how multi-currency balances are shown.
 */
export function BalanceSummary({ balances, subject = 'Overall' }: Props) {
  const nonZero = balances.filter(b => b.minor !== 0);
  if (nonZero.length === 0) {
    return (
      <Text variant="heading" color="neutral">
        You are all settled up
      </Text>
    );
  }
  return (
    <Stack gap="xxs">
      {nonZero.map(b => {
        const tone = amountTone(b.minor);
        return (
          <Text key={b.currency} variant="heading">
            {subject}, {tone === 'positive' ? 'you are owed ' : 'you owe '}
            <Text variant="heading" color={tone}>
              {formatMoney(b.minor, b.currency, { absolute: true })}
            </Text>
          </Text>
        );
      })}
    </Stack>
  );
}
