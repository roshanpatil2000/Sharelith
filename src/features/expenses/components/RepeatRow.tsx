import React from 'react';
import { Repeat } from 'lucide-react-native';
import { Icon, ListRow, SelectField, toast } from '@/components';
import { toAppError } from '@/features/auth/errors';
import {
  repeatOptions,
  repeatSummary,
  useExpenseRepeat,
  useSetRepeat,
  type RepeatChoice,
} from '../repeat';

/**
 * Whether an expense repeats. Whoever added it can change it; others on it
 * just see the schedule.
 */
export function RepeatRow({
  expenseId,
  canChange,
}: {
  expenseId: string;
  canChange: boolean;
}) {
  const { data: repeat } = useExpenseRepeat(expenseId);
  const setRepeat = useSetRepeat(expenseId);

  if (!canChange) {
    return repeat ? (
      <ListRow
        title={repeatSummary(repeat)}
        leading={<Icon icon={Repeat} color="textSecondary" />}
        testID="detail-repeat"
      />
    ) : null;
  }

  const value: RepeatChoice = repeat?.frequency ?? 'never';
  return (
    <>
      <SelectField
        label="Repeat"
        icon={Repeat}
        value={value}
        options={repeatOptions}
        disabled={setRepeat.isPending}
        onChange={choice => {
          if (choice === value) {
            return;
          }
          setRepeat.mutate(choice, {
            onSuccess: () =>
              toast.show(
                choice === 'never'
                  ? 'This expense won’t repeat'
                  : 'We’ll add it again on schedule',
                'success',
              ),
            onError: e => toast.show(toAppError(e).message, 'error'),
          });
        }}
        testID="detail-repeat-select"
      />
      {repeat ? (
        <ListRow
          title={repeatSummary(repeat)}
          leading={<Icon icon={Repeat} color="textSecondary" />}
          testID="detail-repeat"
        />
      ) : null}
    </>
  );
}
