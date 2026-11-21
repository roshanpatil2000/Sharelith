import { toBase, totalInBase, type Rates } from '../convert';

const rates: Rates = {
  base: 'INR',
  date: '2026-11-20',
  rates: { USD: 0.012, EUR: 0.01, JPY: 1.8 },
};

describe('currency conversion', () => {
  it('converts into the base currency, in its minor units', () => {
    expect(toBase(1000, 'USD', rates)).toBe(83333); // $10 → ₹833.33
    expect(toBase(180, 'JPY', rates)).toBe(10000); // ¥180 (no decimals) → ₹100
    expect(toBase(5000, 'INR', rates)).toBe(5000);
  });

  it('gives up on a currency without a rate', () => {
    expect(toBase(100, 'XYZ', rates)).toBeNull();
    expect(totalInBase([{ currency: 'XYZ', minor: 100 }], rates)).toBeNull();
  });

  it('adds balances in several currencies, signs kept', () => {
    expect(
      totalInBase(
        [
          { currency: 'INR', minor: 50000 },
          { currency: 'EUR', minor: -1000 },
        ],
        rates,
      ),
    ).toBe(50000 - 100000);
  });
});
