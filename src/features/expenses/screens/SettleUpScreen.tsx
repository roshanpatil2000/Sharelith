import React, { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HandCoins } from 'lucide-react-native';
import {
  AmountInput,
  Banner,
  Button,
  EmptyState,
  Screen,
  SelectField,
  Stack,
  Text,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { formatMoney } from '@/domain/money';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useFriends } from '@/features/friends/api';
import { useGroup, useGroups } from '@/features/groups/api';
import { useBalances, useGroupMemberBalances, useRecordPayment } from '../api';
import {
  friendSettlements,
  groupSettlements,
  settlementKey,
  type Settlement,
} from '../settle';

type Props = NativeStackScreenProps<RootStackParamList, 'SettleUp'>;

export function SettleUpScreen({ route, navigation }: Props) {
  const { friendId, groupId } = route.params;
  const userId = useUserId();
  const { data: balances, isLoading } = useBalances();
  const { data: group } = useGroup(groupId ?? '');
  const simplify = !!groupId && !!group?.simplify_debts;
  const { data: groupBalances, isLoading: loadingGroup } =
    useGroupMemberBalances(simplify ? groupId : undefined);
  const { data: friends } = useFriends();
  const { data: groups } = useGroups();
  const recordPayment = useRecordPayment();

  const settlements = useMemo((): Settlement[] => {
    if (!userId || !balances) {
      return [];
    }
    if (groupId) {
      return groupSettlements(
        balances,
        groupBalances,
        userId,
        groupId,
        simplify,
      );
    }
    return friendId ? friendSettlements(balances, userId, friendId) : [];
  }, [userId, balances, groupBalances, groupId, friendId, simplify]);

  const [chosen, setChosen] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const selected =
    settlements.find(s => settlementKey(s) === chosen) ?? settlements[0];

  // Start with the full amount owed, and again after choosing another.
  const selectedKey = selected ? settlementKey(selected) : null;
  useEffect(() => {
    if (selected) {
      setAmount(selected.minor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const nameOf = (id: string) =>
    id === userId
      ? 'You'
      : group?.names[id] ??
        friends?.find(f => f.id === id)?.full_name ??
        'Someone';
  const firstName = (id: string) => nameOf(id).split(' ')[0]!;
  const describe = (s: Settlement) =>
    s.from === userId
      ? `You pay ${firstName(s.to)}`
      : `${firstName(s.from)} pays you`;
  const where = (s: Settlement) =>
    s.groupId === null
      ? 'Outside groups'
      : `In ${
          groups?.find(g => g.id === s.groupId)?.name ??
          group?.name ??
          'a group'
        }`;

  const save = async () => {
    setFormError(null);
    if (!selected) {
      return;
    }
    if (amount <= 0) {
      setFormError('Enter an amount.');
      return;
    }
    try {
      await recordPayment.mutateAsync({
        from: selected.from,
        to: selected.to,
        amountMinor: amount,
        currency: selected.currency,
        groupId: selected.groupId,
      });
      toast.show('Payment recorded', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  };

  if (isLoading || (simplify && loadingGroup)) {
    return <Screen>{null}</Screen>;
  }
  if (!selected) {
    return (
      <Screen padded>
        <EmptyState
          icon={HandCoins}
          title="You’re all settled up"
          message="There’s nothing to pay or collect here."
        />
      </Screen>
    );
  }

  const partial = amount > 0 && amount < selected.minor;
  return (
    <Screen scroll padded>
      <Stack gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <Text color="textSecondary">
          Record money paid outside Sharelith, such as cash or UPI. It cancels
          what’s owed.
        </Text>
        {settlements.length > 1 ? (
          <SelectField
            label="Payment"
            value={settlementKey(selected)}
            options={settlements.map(s => ({
              value: settlementKey(s),
              label: `${describe(s)} ${formatMoney(s.minor, s.currency)}`,
              description: where(s),
            }))}
            onChange={setChosen}
            testID="settle-choice"
          />
        ) : null}
        <Stack gap="xs">
          <Text variant="title" testID="settle-who">
            {describe(selected)}
          </Text>
          <Text color="textSecondary">{where(selected)}</Text>
        </Stack>
        <AmountInput
          value={amount}
          currency={selected.currency}
          onChange={setAmount}
          testID="settle-amount"
        />
        {partial ? (
          <Text color="textSecondary" testID="settle-left">
            {formatMoney(selected.minor - amount, selected.currency)} will still
            be owed.
          </Text>
        ) : null}
        <Button
          title="Record payment"
          size="lg"
          fullWidth
          loading={recordPayment.isPending}
          onPress={save}
          testID="settle-save"
        />
      </Stack>
    </Screen>
  );
}
