import React from 'react';
import { Text } from '@/components';
import { toBase } from '@/domain/convert';
import { friendlyDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { useRates } from './rates';

/** "≈ ₹8,320.00 at today's rates" for an amount in another currency. */
export function ConvertedAmount({
  minor,
  currency,
  into,
}: {
  minor: number;
  currency: string;
  into: string | undefined;
}) {
  const show = !!into && into !== currency && minor > 0;
  const { data: rates } = useRates(into, show);
  if (!show || !rates) {
    return null;
  }
  const converted = toBase(minor, currency, rates);
  if (converted === null) {
    return null;
  }
  return (
    <Text variant="caption" color="textSecondary" testID="converted-amount">
      ≈ {formatMoney(converted, into!)} · {friendlyDate(rates.date)}’s rates
    </Text>
  );
}
