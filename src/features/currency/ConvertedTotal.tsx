import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, Text } from '@/components';
import { totalInBase } from '@/domain/convert';
import { formatMoney } from '@/domain/money';
import { friendlyDate } from '@/domain/dates';
import { useProfile } from '@/features/account/api';
import { useIsPro } from '@/features/pro/pro';
import { useRates } from './rates';

type Props = { balances: { currency: string; minor: number }[] };

/**
 * Under a balance in several currencies: the whole thing in your default
 * currency at today's rates (Pro), or a pointer to Pro.
 */
export function ConvertedTotal({ balances }: Props) {
  const navigation = useNavigation();
  const isPro = useIsPro();
  const { data: profile } = useProfile();
  const home = profile?.default_currency;
  const nonZero = balances.filter(b => b.minor !== 0);
  const several = new Set(nonZero.map(b => b.currency)).size > 1;
  const { data: rates, isError } = useRates(home, isPro && several);

  if (!several || !home) {
    return null;
  }
  if (!isPro) {
    return (
      <Pressable
        onPress={() => navigation.navigate('Pro')}
        accessibilityRole="button"
        testID="converted-total-pro"
      >
        <Text variant="caption" color="primary">
          See it all in {home} with Pro
        </Text>
      </Pressable>
    );
  }
  if (isError) {
    return (
      <Text variant="caption" color="textSecondary">
        Exchange rates aren’t available right now.
      </Text>
    );
  }
  if (!rates) {
    return null;
  }
  const total = totalInBase(nonZero, rates);
  if (total === null) {
    return (
      <Text variant="caption" color="textSecondary">
        Can’t convert one of these currencies.
      </Text>
    );
  }
  return (
    <Text variant="caption" color="textSecondary" testID="converted-total">
      {total === 0
        ? 'About even overall'
        : `In all, about ${formatMoney(total, home, {
            absolute: true,
          })} ${total > 0 ? 'owed to you' : 'you owe'}`}{' '}
      · {friendlyDate(rates.date)}’s rates
    </Text>
  );
}
