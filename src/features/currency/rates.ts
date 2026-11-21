import { useQuery } from '@tanstack/react-query';
import type { Rates } from '@/domain/convert';

/**
 * Daily European Central Bank reference rates via Frankfurter (free, no key).
 * Only the currency code is sent. Rates change once a working day.
 */
export const RATES_URL = 'https://api.frankfurter.dev/v1/latest';

export async function fetchRates(base: string): Promise<Rates> {
  const res = await fetch(`${RATES_URL}?base=${encodeURIComponent(base)}`);
  if (!res.ok) {
    throw new Error(`Exchange rates unavailable (${res.status})`);
  }
  const body = (await res.json()) as {
    base: string;
    date: string;
    rates: Record<string, number>;
  };
  return { base: body.base, date: body.date, rates: body.rates };
}

/** Rates from `base`, cached for 6 hours. Off when `enabled` is false. */
export function useRates(base: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['exchangeRates', base],
    enabled: !!base && enabled,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    queryFn: () => fetchRates(base!),
  });
}
