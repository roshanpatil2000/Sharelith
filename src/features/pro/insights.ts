import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/authStore';
import { toAppError } from '@/features/auth/errors';
import { categoryKeys, type CategoryKey } from '@/app/theme/colors';
import { useIsPro } from './pro';
import { insightsKey } from '@/features/expenses/api';

export type InsightRow = {
  month: string;
  category: string;
  currency: string;
  share_minor: number;
  paid_minor: number;
  expense_count: number;
};

/** Your spending rows for the last `months` months (Pro only). */
export function useInsights(months = 12) {
  const userId = useUserId();
  const isPro = useIsPro();
  return useQuery({
    queryKey: [...insightsKey(userId), months],
    enabled: !!userId && isPro,
    queryFn: async (): Promise<InsightRow[]> => {
      const { data, error } = await supabase.rpc('spending_insights', {
        months,
      });
      if (error) {
        throw toAppError(error);
      }
      return (data ?? []).map(r => ({
        ...r,
        share_minor: Number(r.share_minor),
        paid_minor: Number(r.paid_minor),
      }));
    },
  });
}

export type MonthBar = { key: string; label: string; share: number };
export type CategoryBar = { key: CategoryKey; share: number; fraction: number };
export type InsightSummary = {
  currency: string;
  totalShare: number;
  totalPaid: number;
  expenseCount: number;
  months: MonthBar[];
  categories: CategoryBar[];
};

/** Currencies you spent in, biggest first. */
export function currenciesOf(rows: InsightRow[]): string[] {
  const total: Record<string, number> = {};
  for (const r of rows) {
    total[r.currency] = (total[r.currency] ?? 0) + r.share_minor;
  }
  return Object.keys(total).sort((a, b) => (total[b] ?? 0) - (total[a] ?? 0));
}

const asCategory = (c: string): CategoryKey =>
  (categoryKeys as readonly string[]).includes(c)
    ? (c as CategoryKey)
    : 'general';

/**
 * One currency's spending: a bar for each of the last `months` months
 * (empty months included, oldest first) and categories by share, biggest first.
 */
export function summarize(
  rows: InsightRow[],
  currency: string,
  months = 12,
  today = new Date(),
): InsightSummary {
  const mine = rows.filter(r => r.currency === currency);
  const bars: MonthBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1),
    );
    const key = d.toISOString().slice(0, 7);
    bars.push({
      key,
      label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      share: 0,
    });
  }
  const byCategory: Partial<Record<CategoryKey, number>> = {};
  let totalShare = 0;
  let totalPaid = 0;
  let expenseCount = 0;
  for (const r of mine) {
    const bar = bars.find(b => b.key === r.month.slice(0, 7));
    if (bar) {
      bar.share += r.share_minor;
    }
    const cat = asCategory(r.category);
    byCategory[cat] = (byCategory[cat] ?? 0) + r.share_minor;
    totalShare += r.share_minor;
    totalPaid += r.paid_minor;
    expenseCount += r.expense_count;
  }
  const categories = (Object.entries(byCategory) as [CategoryKey, number][])
    .filter(([, share]) => share > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, share]) => ({
      key,
      share,
      fraction: totalShare ? share / totalShare : 0,
    }));
  return {
    currency,
    totalShare,
    totalPaid,
    expenseCount,
    months: bars,
    categories,
  };
}
