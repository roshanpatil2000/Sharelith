import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toAppError } from '@/features/auth/errors';
import { useUserId } from '@/features/auth/authStore';
import { formatMoney } from '@/domain/money';
import { friendlyDate } from '@/domain/dates';
import { categoryLabel } from '@/domain/categorize';

type Person = { user_id: string; paid_minor?: number; owed_minor?: number };

export type ExpenseSnapshot = {
  description: string;
  amount_minor: number;
  currency: string;
  category: string;
  expense_date: string;
  notes: string | null;
  payers: Person[];
  shares: Person[];
};

export type ExpenseRevision = {
  id: string;
  edited_at: string;
  editor_id: string | null;
  editor_name: string;
  before: ExpenseSnapshot;
  after: ExpenseSnapshot;
  names: Record<string, string>;
};

/** Under ['expense', userId, id] so saving an expense refreshes it too. */
export const historyKey = (userId: string | null, expenseId: string) =>
  ['expense', userId, expenseId, 'history'] as const;

export function useExpenseHistory(expenseId: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: historyKey(userId, expenseId),
    enabled: !!userId,
    queryFn: async (): Promise<ExpenseRevision[]> => {
      const { data, error } = await supabase.rpc('list_expense_revisions', {
        eid: expenseId,
      });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []) as unknown as ExpenseRevision[];
    },
  });
}

const amounts = (people: Person[], field: 'paid_minor' | 'owed_minor') =>
  people
    .map(p => `${p.user_id}:${p[field] ?? 0}`)
    .sort()
    .join(',');

/**
 * What changed in one edit, as short phrases:
 * ["amount ₹500.00 → ₹600.00", "description", "split"].
 */
export function describeChanges(r: ExpenseRevision): string[] {
  const { before: b, after: a } = r;
  const out: string[] = [];
  if (b.description !== a.description) {
    out.push(`description “${b.description}” → “${a.description}”`);
  }
  if (b.amount_minor !== a.amount_minor || b.currency !== a.currency) {
    out.push(
      `amount ${formatMoney(b.amount_minor, b.currency)} → ${formatMoney(
        a.amount_minor,
        a.currency,
      )}`,
    );
  }
  if (b.expense_date !== a.expense_date) {
    out.push(
      `date ${friendlyDate(b.expense_date)} → ${friendlyDate(a.expense_date)}`,
    );
  }
  if (b.category !== a.category) {
    out.push(
      `category ${categoryLabel(b.category)} → ${categoryLabel(a.category)}`,
    );
  }
  if ((b.notes ?? '') !== (a.notes ?? '')) {
    out.push('notes');
  }
  if (amounts(b.payers, 'paid_minor') !== amounts(a.payers, 'paid_minor')) {
    out.push('who paid');
  }
  if (amounts(b.shares, 'owed_minor') !== amounts(a.shares, 'owed_minor')) {
    out.push('the split');
  }
  return out;
}

/** "You changed amount ₹500.00 → ₹600.00 and the split" */
export function describeRevision(
  r: ExpenseRevision,
  me: string | null,
): string {
  const who = r.editor_id && r.editor_id === me ? 'You' : r.editor_name;
  const parts = describeChanges(r);
  if (parts.length === 0) {
    return `${who} edited this expense`;
  }
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${who} changed ${list}`;
}
