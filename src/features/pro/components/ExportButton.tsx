import React, { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { IconButton, toast } from '@/components';
import { useExpenses } from '@/features/expenses/api';
import { useProGate } from '../useProGate';
import { buildCsv, buildPdf } from '../exportStatement';
import { fileBase, shareFile } from '../shareFile';

type Props = {
  title: string;
  groupId?: string;
  friendId?: string;
  /** Name for a user id ("You" for yourself). */
  nameOf: (id: string) => string;
};

/** Header button: export this group's or friend's expenses as CSV or PDF (Pro). */
export function ExportButton({ title, groupId, friendId, nameOf }: Props) {
  const gate = useProGate();
  const { data: expenses } = useExpenses({ groupId, friendId });
  const [busy, setBusy] = useState(false);

  const run = async (format: 'csv' | 'pdf') => {
    setBusy(true);
    try {
      const statement = { title, expenses: expenses ?? [], nameOf };
      const base = fileBase(title);
      if (format === 'csv') {
        await shareFile(`${base}.csv`, buildCsv(statement), {
          encoding: 'utf8',
          mime: 'text/csv',
        });
      } else {
        await shareFile(`${base}.pdf`, await buildPdf(statement), {
          encoding: 'base64',
          mime: 'application/pdf',
        });
      }
    } catch {
      toast.show('Couldn’t export. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const choose = () =>
    Alert.alert(
      'Export expenses',
      `${title}: every expense and payment, with your share.`,
      [
        { text: 'CSV (spreadsheet)', onPress: () => run('csv') },
        { text: 'PDF', onPress: () => run('pdf') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );

  if (busy) {
    return <ActivityIndicator accessibilityLabel="Exporting" />;
  }
  return (
    <IconButton
      icon={Share2}
      accessibilityLabel="Export"
      color="primary"
      onPress={gate(choose)}
      disabled={!expenses}
      testID="export-button"
    />
  );
}
