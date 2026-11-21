import { currencyExponent } from './money';

/** Rates from one base currency: 1 base = rates[code] of that currency. */
export type Rates = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

/**
 * An amount in minor units converted to the rates' base currency, rounded to
 * the base's minor unit. Null if there's no rate for it.
 */
export function toBase(
  minor: number,
  currency: string,
  r: Rates,
): number | null {
  if (currency === r.base) {
    return minor;
  }
  const rate = r.rates[currency];
  if (!rate || rate <= 0) {
    return null;
  }
  const major = minor / 10 ** currencyExponent(currency);
  return Math.round((major / rate) * 10 ** currencyExponent(r.base));
}

/**
 * Balances in several currencies added up in the base currency. Null when
 * any of them can't be converted, so a total is never quietly incomplete.
 */
export function totalInBase(
  balances: { currency: string; minor: number }[],
  r: Rates,
): number | null {
  let sum = 0;
  for (const b of balances) {
    const converted = toBase(b.minor, b.currency, r);
    if (converted === null) {
      return null;
    }
    sum += converted;
  }
  return sum;
}
