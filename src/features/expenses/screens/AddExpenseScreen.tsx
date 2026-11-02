import React, { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Receipt, Users } from 'lucide-react-native';
import {
  AmountInput,
  Banner,
  Button,
  Checkbox,
  CurrencyPicker,
  Screen,
  SelectField,
  Stack,
  Text,
  TextField,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { formatMoney } from '@/domain/money';
import { splitEqually } from '@/domain/split';
import { useProfile } from '@/features/account/api';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useFriends } from '@/features/friends/api';
import { useGroup, useGroups } from '@/features/groups/api';
import { useCreateExpense } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const groupTarget = (id: string) => `group:${id}`;
const friendTarget = (id: string) => `friend:${id}`;

export function AddExpenseScreen({ route, navigation }: Props) {
  const { groupId: startGroup, friendId: startFriend } = route.params ?? {};
  const userId = useUserId();
  const { data: profile } = useProfile();
  const { data: groups } = useGroups();
  const { data: friends } = useFriends();
  const createExpense = useCreateExpense();

  const [target, setTarget] = useState(
    startGroup
      ? groupTarget(startGroup)
      : startFriend
      ? friendTarget(startFriend)
      : '',
  );
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState<string | null>(null);
  const [paidBy, setPaidBy] = useState(userId ?? '');
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  const [kind, targetId] = target.split(':');
  const groupId = kind === 'group' ? targetId : undefined;
  const friendId = kind === 'friend' ? targetId : undefined;
  const { data: group } = useGroup(groupId ?? '');

  const targetOptions = useMemo(
    () => [
      ...(groups ?? []).map(g => ({
        value: groupTarget(g.id),
        label: g.name,
        description: 'Group',
      })),
      ...(friends ?? []).map(f => ({
        value: friendTarget(f.id),
        label: f.full_name,
        description: 'Friend',
      })),
    ],
    [groups, friends],
  );

  const people = useMemo(() => {
    if (groupId) {
      return (group?.members ?? []).map(m => ({
        id: m.id,
        name: m.id === userId ? 'You' : m.full_name,
      }));
    }
    const friend = friends?.find(f => f.id === friendId);
    return friend && userId
      ? [
          { id: userId, name: 'You' },
          { id: friend.id, name: friend.full_name },
        ]
      : [];
  }, [groupId, group, friends, friendId, userId]);

  // Choosing someone else to split with starts the choices over.
  useEffect(() => {
    setExcluded(new Set());
    setPaidBy(userId ?? '');
  }, [target, userId]);

  const expenseCurrency =
    currency ?? group?.currency ?? profile?.default_currency ?? 'INR';
  const included = people.filter(p => !excluded.has(p.id)).map(p => p.id);
  const perPerson =
    amount > 0 && included.length > 0
      ? Math.floor(amount / included.length)
      : 0;

  const toggle = (id: string) =>
    setExcluded(previous => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  const save = async () => {
    setFormError(null);
    const name = description.trim();
    if (people.length === 0) {
      setFormError('Choose who to split this with.');
      return;
    }
    if (!name) {
      setFormError('Enter a description.');
      return;
    }
    if (amount <= 0) {
      setFormError('Enter an amount.');
      return;
    }
    if (included.length === 0) {
      setFormError('Choose at least one person to split with.');
      return;
    }
    try {
      await createExpense.mutateAsync({
        description: name,
        amountMinor: amount,
        currency: expenseCurrency,
        groupId,
        paid: { [paidBy]: amount },
        owed: splitEqually(amount, included),
      });
      toast.show('Expense added', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  };

  return (
    <Screen scroll padded>
      <Stack gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        <SelectField
          label="Split with"
          icon={Users}
          value={target}
          options={targetOptions}
          onChange={setTarget}
          searchable
          testID="expense-target"
        />
        <TextField
          label="Description"
          placeholder="Enter a description"
          leadingIcon={Receipt}
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          testID="expense-description"
        />
        <AmountInput
          value={amount}
          currency={expenseCurrency}
          onChange={setAmount}
          testID="expense-amount"
        />
        <CurrencyPicker
          label="Currency"
          value={expenseCurrency}
          onChange={setCurrency}
          testID="expense-currency"
        />
        {people.length > 0 ? (
          <>
            <SelectField
              label="Paid by"
              value={paidBy}
              options={people.map(p => ({ value: p.id, label: p.name }))}
              onChange={setPaidBy}
              testID="expense-paid-by"
            />
            <Stack gap="sm">
              <Text variant="bodyStrong">Split equally between</Text>
              {people.map(p => (
                <Checkbox
                  key={p.id}
                  label={p.name}
                  checked={!excluded.has(p.id)}
                  onChange={() => toggle(p.id)}
                  testID={`expense-include-${p.id}`}
                />
              ))}
              {perPerson > 0 ? (
                <Text color="textSecondary" testID="expense-per-person">
                  {formatMoney(perPerson, expenseCurrency)} each
                </Text>
              ) : null}
            </Stack>
          </>
        ) : null}
        <Button
          title="Save"
          size="lg"
          fullWidth
          loading={createExpense.isPending}
          onPress={save}
          testID="expense-save"
        />
      </Stack>
    </Screen>
  );
}
