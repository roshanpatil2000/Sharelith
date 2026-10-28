/**
 * Money is always stored as an integer number of minor units (paise, cents)
 * together with an ISO 4217 currency code. Never use floats for amounts.
 */

export type Money = { minor: number; currency: string };

const fractionDigitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (INR → 2, JPY → 0). */
export function currencyExponent(currency: string): number {
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) {
    return cached;
  }
  const digits =
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  fractionDigitsCache.set(currency, digits);
  return digits;
}

/** "₹" for INR, "$" for USD. Hermes lacks formatToParts, so strip the digits. */
export function currencySymbol(currency: string, locale = 'en-IN'): string {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(0);
  return formatted.replace(/[\d\s., ]/g, '') || currency;
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** currencyExponent(currency);
}

/** Parses user input like "1,234.5" into minor units; returns null if invalid. */
export function parseToMinor(input: string, currency: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (cleaned === '') {
    return 0;
  }
  const exp = currencyExponent(currency);
  const pattern = exp === 0 ? /^\d+$/ : new RegExp(`^\\d*(\\.\\d{0,${exp}})?$`);
  if (!pattern.test(cleaned) || cleaned === '.') {
    return null;
  }
  const [whole = '0', frac = ''] = cleaned.split('.');
  return Number(whole || '0') * 10 ** exp + Number(frac.padEnd(exp, '0') || 0);
}

type FormatOptions = {
  locale?: string;
  /** Omit the minus sign; callers convey direction with color/wording. */
  absolute?: boolean;
};

export function formatMoney(
  minor: number,
  currency: string,
  { locale = 'en-IN', absolute = false }: FormatOptions = {},
): string {
  const value = toMajor(absolute ? Math.abs(minor) : minor, currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value);
}
