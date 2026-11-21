import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import type { RootStackParamList } from '@/app/navigation/types';
import {
  Banner,
  Button,
  Screen,
  SegmentedControl,
  Stack,
  Text,
  toast,
} from '@/components';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { PersonAmountRow } from '@/features/expenses/components/PersonAmountRow';
import { asDefaultSplit } from '@/features/expenses/splitForm';
import { groupKey, useGroup } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'DefaultSplit'>;
type Kind = 'equal' | 'percent' | 'shares';

const kinds = [
  { value: 'equal', label: 'Equal' },
  { value: 'percent', label: '%' },
  { value: 'shares', label: 'Shares' },
] as const;

/** Up to two decimals, no sign; empty is 0. Null if it isn't a number. */
const parse = (text: string | undefined): number | null => {
  const t = (text ?? '').trim();
  if (!t) {
    return 0;
  }
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
};

/** How new expenses in this group are split to start with. */
export function DefaultSplitScreen({ route, navigation }: Props) {
  const { groupId } = route.params;
  const userId = useUserId();
  const qc = useQueryClient();
  const { data: group } = useGroup(groupId);
  const [kind, setKind] = useState<Kind>('equal');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const loaded = React.useRef(false);

  // Start from what's saved.
  useEffect(() => {
    if (!group || loaded.current) {
      return;
    }
    loaded.current = true;
    const def = asDefaultSplit(group.default_split);
    if (def) {
      setKind(def.type);
      setValues(
        Object.fromEntries(
          group.members.map(m => [m.id, String(def.values[m.id] ?? 0)]),
        ),
      );
    }
  }, [group]);

  const members = group?.members ?? [];
  const choose = (next: Kind) => {
    setError(null);
    setKind(next);
    if (next === 'equal') {
      return;
    }
    // Sensible starting values: equal percentages, or one share each.
    const each =
      next === 'shares'
        ? '1'
        : String(Math.floor((100 / Math.max(members.length, 1)) * 100) / 100);
    setValues(Object.fromEntries(members.map(m => [m.id, each])));
  };

  const numbers = Object.fromEntries(
    members.map(m => [m.id, parse(values[m.id])]),
  );
  const sum = members.reduce((acc, m) => acc + (numbers[m.id] ?? 0), 0);
  const percentLeft = Math.round((100 - sum) * 100) / 100;

  const save = async () => {
    setError(null);
    if (Object.values(numbers).some(n => n === null)) {
      setError('Use numbers like 25 or 33.33.');
      return;
    }
    if (kind === 'percent' && percentLeft !== 0) {
      setError('Percentages must add up to 100.');
      return;
    }
    if (kind === 'shares' && sum <= 0) {
      setError('Give at least one person a share.');
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.rpc('set_group_default_split', {
      gid: groupId,
      split:
        kind === 'equal'
          ? null
          : { type: kind, values: numbers as Record<string, number> },
    });
    setSaving(false);
    if (e) {
      setError(toAppError(e).message);
      return;
    }
    await qc.invalidateQueries({ queryKey: groupKey(userId, groupId) });
    toast.show('Default split saved', 'success');
    navigation.goBack();
  };

  return (
    <Screen scroll padded edges={['bottom', 'left', 'right']}>
      <Stack gap="lg">
        <Text color="textSecondary">
          New expenses in this group start split this way. You can still change
          the split on any expense.
        </Text>
        {error ? <Banner tone="danger" message={error} /> : null}
        <SegmentedControl
          segments={kinds}
          value={kind}
          onChange={choose}
          testID="default-split-type"
        />
        {kind === 'equal' ? (
          <Text color="textSecondary">Everyone pays the same.</Text>
        ) : (
          <Stack gap="sm">
            {members.map(m => (
              <PersonAmountRow
                key={m.id}
                name={m.id === userId ? 'You' : m.full_name}
                suffix={kind === 'percent' ? '%' : 'shares'}
                value={values[m.id] ?? ''}
                onChange={text =>
                  setValues(prev => ({ ...prev, [m.id]: text }))
                }
                testID={`default-split-${m.id}`}
              />
            ))}
            {kind === 'percent' && percentLeft !== 0 ? (
              <Text variant="caption" color="textSecondary">
                {percentLeft > 0
                  ? `${percentLeft}% left to assign`
                  : `${-percentLeft}% over 100%`}
              </Text>
            ) : null}
          </Stack>
        )}
        <Button
          title="Save"
          size="lg"
          fullWidth
          loading={saving}
          onPress={save}
          testID="default-split-save"
        />
      </Stack>
    </Screen>
  );
}
