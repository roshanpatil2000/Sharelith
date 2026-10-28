import React from 'react';
import { formatMoney } from '@/domain/money';
import type { TypographyVariant } from '@/app/theme';
import { Text } from '../primitives/Text';

type Props = {
  /** Signed minor units from the viewer's perspective: + owed to you, − you owe. */
  minor: number;
  currency: string;
  variant?: TypographyVariant;
  /** Color by sign (positive/negative/neutral). Off → plain text color. */
  colored?: boolean;
  testID?: string;
};

export function amountTone(minor: number): 'positive' | 'negative' | 'neutral' {
  if (minor > 0) {
    return 'positive';
  }
  if (minor < 0) {
    return 'negative';
  }
  return 'neutral';
}

export function AmountText({
  minor,
  currency,
  variant = 'amount',
  colored = true,
  testID,
}: Props) {
  return (
    <Text
      testID={testID}
      variant={variant}
      color={colored ? amountTone(minor) : 'textPrimary'}
    >
      {formatMoney(minor, currency, { absolute: colored })}
    </Text>
  );
}
