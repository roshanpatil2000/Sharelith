import { formatMoney } from '@/domain/money';
import type { ExpenseDetail, ShareRow } from './api';

const SPLIT_NAMES: Record<string, string> = {
  equal: 'Split equally',
  exact: 'Split by exact amounts',
  percent: 'Split by percentage',
  shares: 'Split by shares',
  adjustment: 'Split equally, with adjustments',
};

/** "Split by percentage". Mixed or unknown types fall back to "Split". */
export function splitTitle(expense: ExpenseDetail): string {
  const types = new Set(expense.expense_shares.map(s => s.split_type));
  const [only] = [...types];
  return types.size === 1 && only ? SPLIT_NAMES[only] ?? 'Split' : 'Split';
}

/** What was entered for one person: "50%", "2 shares", "+₹10.00". */
export function shareNote(share: ShareRow, currency: string): string | null {
  const raw = share.raw_value;
  if (raw === null || raw === undefined) {
    return null;
  }
  switch (share.split_type) {
    case 'percent':
      return `${Number(raw)}%`;
    case 'shares':
      return Number(raw) === 1 ? '1 share' : `${Number(raw)} shares`;
    case 'adjustment':
      return raw === 0
        ? null
        : `${raw > 0 ? '+' : '−'}${formatMoney(Math.abs(raw), currency)}`;
    default:
      return null;
  }
}

/** What the expense does to you: + you lent, − you borrowed. */
export function myNet(expense: ExpenseDetail, me: string | null): number {
  const paid =
    expense.expense_payers.find(p => p.user_id === me)?.paid_minor ?? 0;
  const owed =
    expense.expense_shares.find(s => s.user_id === me)?.owed_minor ?? 0;
  return paid - owed;
}
