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
import {
  equalSplitRows,
  useCreateExpense,
  useExpense,
  useRenameExpense,
  useUpdateExpense,
  type ExpenseDetail,
} from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const groupTarget = (id: string) => `group:${id}`;
const friendTarget = (id: string) => `friend:${id}`;

/**
 * Whether this form can show and rebuild the split: one payer, and shares
 * that are exactly an equal split among the people on it.
 */
export function isSimpleEqualSplit(
  expense: ExpenseDetail,
  peopleOrder: string[],
): boolean {
  const sharers = expense.expense_shares.map(s => s.user_id);
  if (
    expense.expense_payers.length !== 1 ||
    expense.expense_shares.some(s => s.split_type !== 'equal') ||
    sharers.some(id => !peopleOrder.includes(id))
  ) {
    return false;
  }
  const ordered = peopleOrder.filter(id => sharers.includes(id));
  const expected = splitEqually(expense.amount_minor, ordered);
  return expense.expense_shares.every(
    s => expected[s.user_id] === s.owed_minor,
  );
}

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
  // Only the name can change: someone else added it, or this form can't
  // rebuild its split.
  const [nameOnly, setNameOnly] = useState<'notMine' | 'customSplit' | null>(
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

  // Choosing someone else to split with starts the choices over. Editing
  // keeps the expense's own group or friend.
  useEffect(() => {
    if (editing) {
      return;
    }
    setExcluded(new Set());
    setPaidBy(userId ?? '');
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
    if (existing.created_by !== userId) {
      setNameOnly('notMine');
    } else if (
      isSimpleEqualSplit(
        existing,
        people.map(p => p.id),
      )
    ) {
      setPaidBy(existing.expense_payers[0]!.user_id);
      const sharers = new Set(existing.expense_shares.map(s => s.user_id));
      setExcluded(
        new Set(people.filter(p => !sharers.has(p.id)).map(p => p.id)),
      );
    } else {
      setNameOnly('customSplit');
    }
    setReady(true);
  }, [existing, people, groupId, group, friendId, friends, userId]);

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
    if (included.length === 0) {
      setFormError('Choose at least one person to split with.');
      return;
    }
    try {
      const paid = { [paidBy]: amount };
      const owed = splitEqually(amount, included);
      if (existing) {
        await updateExpense.mutateAsync({
          id: existing.id,
          description: name,
          amountMinor: amount,
          currency: expenseCurrency,
          ...equalSplitRows(paid, owed),
        });
      } else {
        await createExpense.mutateAsync({
          description: name,
          amountMinor: amount,
          currency: expenseCurrency,
          groupId,
          paid,
          owed,
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
                : 'This expense has a split this screen can’t change yet. You can rename it; who paid and who owes stay the same.'
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
