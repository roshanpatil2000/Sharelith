import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Receipt, Users } from 'lucide-react-native';
import {
  AmountInput,
  Banner,
  Button,
  Checkbox,
  CurrencyPicker,
  Row,
  Screen,
  SegmentedControl,
  SelectField,
  Stack,
  Text,
  TextField,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { currencySymbol, formatMoney, minorToInput } from '@/domain/money';
import { useProfile } from '@/features/account/api';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { useFriends } from '@/features/friends/api';
import { useGroup, useGroups } from '@/features/groups/api';
import {
  useCreateExpense,
  useExpense,
  useRenameExpense,
  useUpdateExpense,
} from '../api';
import { PersonAmountRow } from '../components/PersonAmountRow';
import {
  SPLIT_TYPES,
  computePayers,
  computeSplit,
  draftFromExpense,
  emptySplit,
  type PayerDraft,
  type SplitDraft,
  type SplitType,
} from '../splitForm';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const groupTarget = (id: string) => `group:${id}`;
const friendTarget = (id: string) => `friend:${id}`;
const MULTIPLE = 'multiple';

export function AddExpenseScreen({ route, navigation }: Props) {
  const {
    groupId: startGroup,
    friendId: startFriend,
    expenseId,
  } = route.params ?? {};
  const editing = !!expenseId;
  const userId = useUserId();
  const { data: existing, isLoading: loadingExisting } = useExpense(expenseId);
  const updateExpense = useUpdateExpense();
  const renameExpense = useRenameExpense();
  const loaded = useRef(false);
  // Only the name can change: someone else added it, or someone on it has
  // left so its split can't be rebuilt.
  const [nameOnly, setNameOnly] = useState<'notMine' | 'someoneLeft' | null>(
    null,
  );
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
  const [payer, setPayer] = useState<PayerDraft>({
    mode: 'single',
    id: userId ?? '',
  });
  const [split, setSplit] = useState<SplitDraft>(emptySplit);
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
  const ids = useMemo(() => people.map(p => p.id), [people]);

  // Choosing someone else to split with starts the choices over. Editing
  // keeps the expense's own group or friend.
  useEffect(() => {
    if (editing) {
      return;
    }
    setSplit(emptySplit());
    setPayer({ mode: 'single', id: userId ?? '' });
  }, [target, userId, editing]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit expense' : 'Add expense' });
  }, [navigation, editing]);

  // Point the form at the expense's group or friend.
  useEffect(() => {
    if (!existing || target) {
      return;
    }
    if (existing.group_id) {
      setTarget(groupTarget(existing.group_id));
      return;
    }
    const other = [
      ...existing.expense_payers.map(p => p.user_id),
      ...existing.expense_shares.map(s => s.user_id),
    ].find(id => id !== userId);
    if (other) {
      setTarget(friendTarget(other));
    }
  }, [existing, target, userId]);

  // Fill the form once the expense and its people have loaded.
  const [, setReady] = useState(false);
  useEffect(() => {
    // Ready once the group or friend list has loaded, even if someone on
    // the expense is no longer in it.
    const peopleLoaded = groupId ? !!group : !!friendId && !!friends;
    if (!existing || loaded.current || !peopleLoaded) {
      return;
    }
    loaded.current = true;
    setDescription(existing.description);
    setAmount(existing.amount_minor);
    setCurrency(existing.currency);
    const restored = draftFromExpense(existing, ids);
    if (existing.created_by !== userId) {
      setNameOnly('notMine');
    } else if (restored) {
      setSplit(restored.split);
      setPayer(restored.payers);
    } else {
      setNameOnly('someoneLeft');
    }
    setReady(true);
  }, [existing, ids, groupId, group, friendId, friends, userId]);

  const expenseCurrency =
    currency ?? group?.currency ?? profile?.default_currency ?? 'INR';
  const symbol = currencySymbol(expenseCurrency);
  const splitResult = computeSplit(amount, expenseCurrency, ids, split);
  const payerResult = computePayers(amount, expenseCurrency, ids, payer);
  const money = (minor: number) => formatMoney(minor, expenseCurrency);

  const setSplitType = (type: SplitType) =>
    setSplit(previous => {
      // Shares start at one each, the usual starting point.
      if (
        type === 'shares' &&
        Object.keys(previous.values.shares).length === 0
      ) {
        return {
          ...previous,
          type,
          values: {
            ...previous.values,
            shares: Object.fromEntries(ids.map(id => [id, '1'])),
          },
        };
      }
      return { ...previous, type };
    });

  const setSplitValue = (id: string, text: string) =>
    setSplit(previous =>
      previous.type === 'equal'
        ? previous
        : {
            ...previous,
            values: {
              ...previous.values,
              [previous.type]: {
                ...previous.values[previous.type],
                [id]: text,
              },
            },
          },
    );

  const toggle = (id: string) =>
    setSplit(previous => ({
      ...previous,
      excluded: previous.excluded.includes(id)
        ? previous.excluded.filter(x => x !== id)
        : [...previous.excluded, id],
    }));

  const choosePayer = (value: string) =>
    setPayer(previous =>
      value !== MULTIPLE
        ? { mode: 'single', id: value }
        : previous.mode === 'multiple'
        ? previous
        : // Start from whoever was chosen paying it all.
          {
            mode: 'multiple',
            values:
              amount > 0
                ? { [previous.id]: minorToInput(amount, expenseCurrency) }
                : {},
          },
    );

  const save = async () => {
    setFormError(null);
    const name = description.trim();
    if (!name) {
      setFormError('Enter a description.');
      return;
    }
    if (existing && nameOnly) {
      try {
        await renameExpense.mutateAsync({ id: existing.id, description: name });
        toast.show('Expense saved', 'success');
        navigation.goBack();
      } catch (e) {
        setFormError(toAppError(e).message);
      }
      return;
    }
    if (people.length === 0) {
      setFormError('Choose who to split this with.');
      return;
    }
    if (amount <= 0) {
      setFormError('Enter an amount.');
      return;
    }
    if (!payerResult.rows) {
      setFormError(payerResult.error);
      return;
    }
    if (!splitResult.rows) {
      setFormError(splitResult.error);
      return;
    }
    try {
      if (existing) {
        await updateExpense.mutateAsync({
          id: existing.id,
          description: name,
          amountMinor: amount,
          currency: expenseCurrency,
          payers: payerResult.rows,
          shares: splitResult.rows,
        });
      } else {
        await createExpense.mutateAsync({
          description: name,
          amountMinor: amount,
          currency: expenseCurrency,
          groupId,
          payers: payerResult.rows,
          shares: splitResult.rows,
        });
      }
      toast.show(existing ? 'Expense saved' : 'Expense added', 'success');
      navigation.goBack();
    } catch (e) {
      setFormError(toAppError(e).message);
    }
  };

  // Who added it, for the rename-only note.
  const addedBy =
    (existing &&
      (group?.names[existing.created_by] ??
        friends?.find(f => f.id === existing.created_by)?.full_name)) ||
    'the person who added it';

  if (editing && (loadingExisting || (existing && !loaded.current))) {
    return <Screen>{null}</Screen>;
  }
  if (editing && !existing) {
    return (
      <Screen padded>
        <Banner tone="danger" message="This expense was deleted." />
      </Screen>
    );
  }

  const owedText = (id: string) =>
    amount > 0 && splitResult.owed[id] ? money(splitResult.owed[id]!) : '';

  return (
    <Screen scroll padded>
      <Stack gap="lg">
        {formError ? <Banner tone="danger" message={formError} /> : null}
        {nameOnly ? (
          <Banner
            tone="info"
            message={
              nameOnly === 'notMine'
                ? `Only ${addedBy} can change the amount or delete this expense. You can rename it.`
                : 'Someone on this expense is no longer here, so its amounts can’t change. You can rename it.'
            }
          />
        ) : null}
        <SelectField
          label="Split with"
          icon={Users}
          value={target}
          options={targetOptions}
          onChange={setTarget}
          searchable
          disabled={editing}
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
        {nameOnly ? null : (
          <>
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
                  value={payer.mode === 'single' ? payer.id : MULTIPLE}
                  options={[
                    ...people.map(p => ({ value: p.id, label: p.name })),
                    { value: MULTIPLE, label: 'Multiple people' },
                  ]}
                  onChange={choosePayer}
                  testID="expense-paid-by"
                />
                {payer.mode === 'multiple' ? (
                  <Stack gap="sm">
                    {people.map(p => (
                      <PersonAmountRow
                        key={p.id}
                        name={p.name}
                        prefix={symbol}
                        value={payer.values[p.id] ?? ''}
                        onChange={text =>
                          setPayer({
                            mode: 'multiple',
                            values: { ...payer.values, [p.id]: text },
                          })
                        }
                        testID={`expense-paid-${p.id}`}
                      />
                    ))}
                    {amount > 0 &&
                    payerResult.error &&
                    payerResult.error !== formError ? (
                      <Text
                        variant="caption"
                        color="textSecondary"
                        testID="expense-paid-status"
                      >
                        {payerResult.error}
                      </Text>
                    ) : null}
                  </Stack>
                ) : null}
                <Stack gap="sm">
                  <Text variant="bodyStrong">Split</Text>
                  <SegmentedControl
                    segments={SPLIT_TYPES}
                    value={split.type}
                    onChange={setSplitType}
                    testID="expense-split-type"
                  />
                  {people.map(p =>
                    split.type === 'equal' ? (
                      <Row key={p.id} gap="md" justify="space-between">
                        <Checkbox
                          label={p.name}
                          checked={!split.excluded.includes(p.id)}
                          onChange={() => toggle(p.id)}
                          testID={`expense-include-${p.id}`}
                        />
                        <Text
                          color="textSecondary"
                          testID={`expense-owed-${p.id}`}
                        >
                          {owedText(p.id)}
                        </Text>
                      </Row>
                    ) : (
                      <PersonAmountRow
                        key={p.id}
                        name={p.name}
                        prefix={
                          split.type === 'exact' || split.type === 'adjustment'
                            ? split.type === 'adjustment'
                              ? `± ${symbol}`
                              : symbol
                            : undefined
                        }
                        suffix={
                          split.type === 'percent'
                            ? '%'
                            : split.type === 'shares'
                            ? 'shares'
                            : undefined
                        }
                        signed={split.type === 'adjustment'}
                        value={split.values[split.type][p.id] ?? ''}
                        onChange={text => setSplitValue(p.id, text)}
                        result={
                          split.type === 'exact' ? undefined : owedText(p.id)
                        }
                        testID={`expense-split-${p.id}`}
                      />
                    ),
                  )}
                  {amount > 0 &&
                  splitResult.error &&
                  splitResult.error !== formError ? (
                    <Text
                      variant="caption"
                      color="textSecondary"
                      testID="expense-split-status"
                    >
                      {splitResult.error}
                    </Text>
                  ) : split.type === 'adjustment' ? (
                    <Text variant="caption" color="textSecondary">
                      Add or take off an amount for someone; the rest is split
                      equally.
                    </Text>
                  ) : null}
                </Stack>
              </>
            ) : null}
          </>
        )}
        <Button
          title="Save"
          size="lg"
          fullWidth
          loading={
            createExpense.isPending ||
            updateExpense.isPending ||
            renameExpense.isPending
          }
          onPress={save}
          testID="expense-save"
        />
      </Stack>
    </Screen>
  );
}
