import React from 'react';
import { Plus, Trash2 } from 'lucide-react-native';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  IconButton,
  Row,
  Stack,
  Text,
  TextField,
} from '@/components';
import type { ItemDraft, SplitDraft } from '../splitForm';
import { PersonAmountRow } from './PersonAmountRow';

type Person = { id: string; name: string };

type Props = {
  draft: SplitDraft;
  people: Person[];
  symbol: string;
  onChange: (update: (previous: SplitDraft) => SplitDraft) => void;
  /** Each person's amount so far, formatted. */
  owedText: (id: string) => string;
};

let counter = 0;
const newKey = () => `item-${Date.now()}-${counter++}`;

/**
 * An itemized bill: each item's price is shared by whoever had it, and tax
 * or tip is shared in proportion to what each person had.
 */
export function ItemizedSplit({
  draft,
  people,
  symbol,
  onChange,
  owedText,
}: Props) {
  const everyone = people.map(p => p.id);

  const update = (key: string, change: Partial<ItemDraft>) =>
    onChange(prev => ({
      ...prev,
      items: prev.items.map(i => (i.key === key ? { ...i, ...change } : i)),
    }));
  const add = () =>
    onChange(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { key: newKey(), name: '', amount: '', people: everyone },
      ],
    }));
  const remove = (key: string) =>
    onChange(prev => ({
      ...prev,
      items: prev.items.filter(i => i.key !== key),
    }));
  const togglePerson = (item: ItemDraft, id: string) =>
    update(item.key, {
      people: item.people.includes(id)
        ? item.people.filter(x => x !== id)
        : [...item.people, id],
    });

  return (
    <Stack gap="sm">
      {draft.items.map((item, n) => (
        <Card key={item.key}>
          <Stack p="md" gap="sm">
            <Row gap="sm">
              <Stack flex={1}>
                <TextField
                  value={item.name}
                  onChangeText={name => update(item.key, { name })}
                  placeholder={`Item ${n + 1}`}
                  maxLength={100}
                  testID={`item-name-${n}`}
                />
              </Stack>
              <IconButton
                icon={Trash2}
                accessibilityLabel={`Remove item ${n + 1}`}
                color="textSecondary"
                onPress={() => remove(item.key)}
                testID={`item-remove-${n}`}
              />
            </Row>
            <PersonAmountRow
              name="Price"
              prefix={symbol}
              value={item.amount}
              onChange={amount => update(item.key, { amount })}
              testID={`item-amount-${n}`}
            />
            <Text variant="caption" color="textSecondary">
              Who had it
            </Text>
            <ChipGroup>
              {people.map(p => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={item.people.includes(p.id)}
                  onPress={() => togglePerson(item, p.id)}
                  testID={`item-${n}-person-${p.id}`}
                />
              ))}
            </ChipGroup>
          </Stack>
        </Card>
      ))}
      <Button
        title="Add item"
        icon={Plus}
        variant="secondary"
        onPress={add}
        testID="item-add"
      />
      <PersonAmountRow
        name="Tax, tip or service"
        prefix={symbol}
        value={draft.extra}
        onChange={extra => onChange(prev => ({ ...prev, extra }))}
        testID="item-extra"
      />
      {draft.items.length ? (
        <Stack gap="xs">
          {people.map(p => (
            <Row key={p.id} justify="space-between">
              <Text>{p.name}</Text>
              <Text color="textSecondary" testID={`expense-owed-${p.id}`}>
                {owedText(p.id)}
              </Text>
            </Row>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
