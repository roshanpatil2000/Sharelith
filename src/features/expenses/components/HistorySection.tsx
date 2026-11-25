import React from 'react';
import { History } from 'lucide-react-native';
import { Icon, ListRow, SectionHeader } from '@/components';
import { useUserId } from '@/features/auth/authStore';
import { friendlyDate, toISODate } from '@/domain/dates';
import { describeRevision, useExpenseHistory } from '../history';

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${friendlyDate(toISODate(d))}, ${time}`;
};

/** Every edit made to an expense, newest first. Hidden until there is one. */
export function HistorySection({ expenseId }: { expenseId: string }) {
  const me = useUserId();
  const { data } = useExpenseHistory(expenseId);
  if (!data?.length) {
    return null;
  }
  return (
    <>
      <SectionHeader title="History" />
      {data.map(r => (
        <ListRow
          key={r.id}
          title={describeRevision(r, me)}
          subtitle={when(r.edited_at)}
          leading={<Icon icon={History} color="textSecondary" />}
          testID={`revision-${r.id}`}
        />
      ))}
    </>
  );
}
