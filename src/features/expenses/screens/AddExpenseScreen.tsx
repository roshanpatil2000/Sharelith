import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { useStyles, type Theme } from '@/app/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, NotebookPen } from 'lucide-react-native';
import {
  AmountInput,
  Appear,
  Banner,
  Button,
  CategoryIcon,
  Checkbox,
  CurrencyPicker,
  FormHeader,
  PillTrigger,
  Pressable,
  Row,
  Screen,
  SelectField,
  DateField,
  Stack,
  Text,
  TextField,
  toast,
} from '@/components';
import type { RootStackParamList } from '@/app/navigation/types';
import { currencySymbol, formatMoney, minorToInput } from '@/domain/money';
import {
  asCategoryKey,
  categoryLabel,
  guessCategory,
} from '@/domain/categorize';
import { todayISO } from '@/domain/dates';
import { categoryKeys, type CategoryKey } from '@/app/theme/colors';
import { useProfile } from '@/features/account/api';
import { storage } from '@/lib/storage';
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
import { useAdPlacement } from '@/features/ads/ads';
import { maybeShowInterstitial } from '@/features/ads/interstitial';
import { ConvertedAmount } from '@/features/currency/ConvertedAmount';
import { ItemizedSplit } from '../components/ItemizedSplit';
import { PersonAmountRow } from '../components/PersonAmountRow';
import {
  SPLIT_TYPES,
  asDefaultSplit,
  computePayers,
  computeSplit,
  draftFromDefault,
  draftFromExpense,
  emptySplit,
  itemsTotal,
  type PayerDraft,
  type SplitDraft,
  type SplitType,
} from '../splitForm';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const groupTarget = (id: string) => `group:${id}`;
const friendTarget = (id: string) => `friend:${id}`;
const MULTIPLE = 'multiple';
/** The group or friend the last new expense was split with. */
const LAST_TARGET_KEY = 'expense.lastTarget';

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
  const adsEnabled = useAdPlacement('interstitial');

  const [target, setTarget] = useState(
    startGroup
      ? groupTarget(startGroup)
      : startFriend
      ? friendTarget(startFriend)
      : '',
  );
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryKey>('general');
  // Once someone picks a category (or an existing one loads), stop guessing.
  const categoryChosen = useRef(false);
  const describe = (text: string) => {
    setDescription(text);
    if (!categoryChosen.current) {
      setCategory(guessCategory(text) ?? 'general');
    }
  };
  const chooseCategory = (key: CategoryKey) => {
    categoryChosen.current = true;
    setCategory(key);
  };
  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const styles = useStyles(createStyles);
  const title = editing ? 'Edit expense' : 'Add expense';
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

  // Opened without a group or friend (the Add expense button): start with
  // the one used last, or the only one there is.
  const prefilled = useRef(false);
  useEffect(() => {
    if (editing || target || prefilled.current || !groups || !friends) {
      return;
    }
    prefilled.current = true;
    const last = storage.getString(LAST_TARGET_KEY);
    const choice =
      targetOptions.find(o => o.value === last)?.value ??
      (targetOptions.length === 1 ? targetOptions[0]?.value : undefined);
    if (choice) {
      setTarget(choice);
    }
  }, [editing, target, groups, friends, targetOptions]);

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

  const defaultApplied = useRef<string | null>(null);
  // Choosing someone else to split with starts the choices over. Editing
  // keeps the expense's own group or friend.
  useEffect(() => {
    if (editing) {
      return;
    }
    setSplit(emptySplit());
    setPayer({ mode: 'single', id: userId ?? '' });
    defaultApplied.current = null;
  }, [target, userId, editing]);

  // A new expense in a group with a default split starts from it, once the
  // group has loaded (only once per group, so a refresh can't undo typing).
  useEffect(() => {
    if (editing || !groupId || group?.id !== groupId) {
      return;
    }
    if (defaultApplied.current === groupId) {
      return;
    }
    defaultApplied.current = groupId;
    const def = asDefaultSplit(group.default_split);
    if (def) {
      setSplit(draftFromDefault(def, ids));
    }
  }, [editing, groupId, group, ids]);

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
    setCategory(asCategoryKey(existing.category));
    setExpenseDate(existing.expense_date);
    setNotes(existing.notes ?? '');
    categoryChosen.current = true;
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
  const itemsSum =
    split.type === 'itemized' ? itemsTotal(split, expenseCurrency) : null;

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
      previous.type === 'equal' || previous.type === 'itemized'
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
      setFormError(
        targetOptions.length
          ? 'Choose a group or friend to split this with.'
          : 'Add a friend or create a group first, then split this with them.',
      );
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
          category,
          expenseDate,
          notes: notes.trim() || null,
        });
      } else {
        await createExpense.mutateAsync({
          description: name,
          amountMinor: amount,
          currency: expenseCurrency,
          groupId,
          payers: payerResult.rows,
          shares: splitResult.rows,
          category,
          expenseDate,
          notes: notes.trim() || null,
        });
        storage.set(LAST_TARGET_KEY, target);
      }
      toast.show(existing ? 'Expense saved' : 'Expense added', 'success');
      navigation.goBack();
      if (!existing) {
        // A natural break; capped so ads stay occasional.
        maybeShowInterstitial(adsEnabled).catch(() => {});
      }
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
    return (
      <Screen
        edges={FORM_EDGES}
        header={
          <FormHeader title={title} onClose={() => navigation.goBack()} />
        }
      >
        {null}
      </Screen>
    );
  }
  if (editing && !existing) {
    return (
      <Screen
        padded
        edges={FORM_EDGES}
        header={
          <FormHeader title={title} onClose={() => navigation.goBack()} />
        }
      >
        <Banner tone="danger" message="This expense was deleted." />
      </Screen>
    );
  }

  const owedText = (id: string) =>
    amount > 0 && splitResult.owed[id] ? money(splitResult.owed[id]!) : '';

  const header = (
    <FormHeader
      title={title}
      onClose={() => navigation.goBack()}
      action={{
        title: 'Save',
        onPress: save,
        loading:
          createExpense.isPending ||
          updateExpense.isPending ||
          renameExpense.isPending,
        testID: 'expense-save',
      }}
    />
  );

  // Date and notes, within reach above the keyboard.
  const toolbar = nameOnly ? null : (
    <Row gap="sm" px="lg" py="sm" style={styles.toolbar}>
      <DateField
        label="Date"
        value={expenseDate}
        onChange={setExpenseDate}
        maximum={todayISO()}
        testID="expense-date"
        renderTrigger={(open, day) => (
          <PillTrigger
            label="Date"
            text={day}
            icon={Calendar}
            onPress={open}
            testID="expense-date"
          />
        )}
      />
      <PillTrigger
        label={notes ? 'Edit notes' : 'Add notes'}
        text="Notes"
        icon={NotebookPen}
        onPress={() => setNotesOpen(open => !open)}
        testID="expense-notes-toggle"
      />
    </Row>
  );

  return (
    <Appear from="grow" style={styles.fill}>
      <Screen scroll edges={FORM_EDGES} header={header} footer={toolbar}>
        <Row gap="sm" px="lg" py="md" style={styles.withRow}>
          <Text>
            With <Text variant="bodyStrong">you</Text> and
          </Text>
          <View style={styles.target}>
            <SelectField
              label="Split with"
              value={target}
              options={targetOptions}
              onChange={setTarget}
              searchable
              testID="expense-target"
              renderTrigger={({ open, selected }) => (
                <PillTrigger
                  label="Split with"
                  text={
                    selected?.label ??
                    (targetOptions.length
                      ? 'Choose a group or friend'
                      : 'Add a friend first')
                  }
                  disabled={editing}
                  onPress={open}
                  testID="expense-target"
                />
              )}
            />
          </View>
        </Row>
        <Stack gap="xl" p="lg">
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
          <Row gap="md" align="flex-start" px="sm">
            {nameOnly ? null : (
              <SelectField
                label="Category"
                value={category}
                options={categoryKeys.map(k => ({
                  value: k,
                  label: categoryLabel(k),
                }))}
                onChange={chooseCategory}
                testID="expense-category"
                renderTrigger={({ open }) => (
                  <Pressable
                    onPress={open}
                    accessibilityLabel={`Category, ${categoryLabel(category)}`}
                    style={styles.category}
                    testID="expense-category"
                  >
                    <CategoryIcon category={category} size={52} />
                    <Text
                      variant="caption"
                      color="textSecondary"
                      numberOfLines={1}
                    >
                      {categoryLabel(category)}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            <View style={styles.grow}>
              <TextField
                appearance="underline"
                placeholder="Enter a description"
                accessibilityLabel="Description"
                value={description}
                onChangeText={describe}
                maxLength={200}
                style={styles.description}
                testID="expense-description"
              />
            </View>
          </Row>
          {nameOnly ? null : (
            <>
              <Stack gap="xs" px="sm">
                <CurrencyPicker
                  label="Currency"
                  value={expenseCurrency}
                  onChange={setCurrency}
                  testID="expense-currency"
                  renderTrigger={open => (
                    <AmountInput
                      value={amount}
                      currency={expenseCurrency}
                      onChange={setAmount}
                      onCurrencyPress={open}
                      currencyTestID="expense-currency"
                      testID="expense-amount"
                    />
                  )}
                />
                <ConvertedAmount
                  minor={amount}
                  currency={expenseCurrency}
                  into={profile?.default_currency}
                />
              </Stack>
              {people.length > 0 ? (
                <>
                  <Row gap="sm" wrap justify="center">
                    <Text>Paid by</Text>
                    <SelectField
                      label="Paid by"
                      value={payer.mode === 'single' ? payer.id : MULTIPLE}
                      options={[
                        ...people.map(p => ({ value: p.id, label: p.name })),
                        { value: MULTIPLE, label: 'Multiple people' },
                      ]}
                      onChange={choosePayer}
                      testID="expense-paid-by"
                      renderTrigger={({ open, selected }) => (
                        <PillTrigger
                          label="Paid by"
                          text={
                            payer.mode === 'single' && payer.id === userId
                              ? 'you'
                              : selected?.label ?? 'choose'
                          }
                          onPress={open}
                          testID="expense-paid-by"
                        />
                      )}
                    />
                    <Text>and split</Text>
                    <SelectField
                      label="Split"
                      value={split.type}
                      options={SPLIT_OPTIONS}
                      onChange={setSplitType}
                      testID="expense-split-type"
                      renderTrigger={({ open }) => (
                        <PillTrigger
                          label="Split"
                          text={SPLIT_PHRASE[split.type]}
                          onPress={open}
                          testID="expense-split-type"
                        />
                      )}
                    />
                  </Row>
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
                  <Appear key={split.type}>
                    <Stack gap="sm">
                      {split.type === 'itemized' ? (
                        <ItemizedSplit
                          draft={split}
                          people={people}
                          symbol={symbol}
                          onChange={setSplit}
                          owedText={owedText}
                        />
                      ) : null}
                      {people.map(p =>
                        split.type === 'itemized' ? null : split.type ===
                          'equal' ? (
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
                              split.type === 'exact' ||
                              split.type === 'adjustment'
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
                              split.type === 'exact'
                                ? undefined
                                : owedText(p.id)
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
                      ) : null}
                      {amount > 0 &&
                      split.type === 'itemized' &&
                      splitResult.error &&
                      itemsSum !== null &&
                      itemsSum > 0 &&
                      itemsSum !== amount ? (
                        <Button
                          title={`Make the total ${money(itemsSum)}`}
                          size="sm"
                          variant="ghost"
                          onPress={() => setAmount(itemsSum)}
                          testID="item-use-total"
                        />
                      ) : null}
                      {split.type === 'adjustment' && !splitResult.error ? (
                        <Text variant="caption" color="textSecondary">
                          Add or take off an amount for someone; the rest is
                          split equally.
                        </Text>
                      ) : null}
                    </Stack>
                  </Appear>
                </>
              ) : null}
              {notesOpen || notes ? (
                <Appear>
                  <TextField
                    label="Notes (optional)"
                    appearance="underline"
                    placeholder="Anything to remember about this"
                    value={notes}
                    onChangeText={setNotes}
                    maxLength={1000}
                    multiline
                    testID="expense-notes"
                  />
                </Appear>
              ) : null}
            </>
          )}
        </Stack>
      </Screen>
    </Appear>
  );
}

const SPLIT_HELP: Record<SplitType, string> = {
  equal: 'The same for everyone you include',
  exact: 'Type what each person owes',
  percent: 'By percentage of the total',
  shares: 'In shares, such as 2 for a couple',
  adjustment: 'Equal, plus or minus an amount for someone',
  itemized: 'Item by item, with tax and tip',
};
const SPLIT_OPTIONS = SPLIT_TYPES.map(option => ({
  ...option,
  description: SPLIT_HELP[option.value],
}));

/** The split, worded to finish "Paid by you and split …". */
const SPLIT_PHRASE: Record<SplitType, string> = {
  equal: 'equally',
  exact: 'by exact amounts',
  percent: 'by percentage',
  shares: 'by shares',
  adjustment: 'with adjustments',
  itemized: 'by items',
};

const FORM_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

const createStyles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    grow: { flex: 1 },
    target: { flexShrink: 1 },
    withRow: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    category: { width: 64, alignItems: 'center', gap: t.spacing.xxs },
    description: { fontSize: 18, lineHeight: 24, minHeight: 50 },
    toolbar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  });
