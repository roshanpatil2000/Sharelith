import {
  currencyExponent,
  currencySymbol,
  formatMoney,
  parseToMinor,
  toMajor,
} from '../money';

describe('money', () => {
  it('knows currency exponents', () => {
    expect(currencyExponent('INR')).toBe(2);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('JPY')).toBe(0);
  });

  it('converts minor to major units', () => {
    expect(toMajor(12345, 'INR')).toBe(123.45);
    expect(toMajor(500, 'JPY')).toBe(500);
  });

  it('parses user input into minor units without float drift', () => {
    expect(parseToMinor('0.1', 'INR')).toBe(10);
    expect(parseToMinor('1,234.56', 'INR')).toBe(123456);
    expect(parseToMinor('19.99', 'USD')).toBe(1999);
    expect(parseToMinor('.5', 'INR')).toBe(50);
    expect(parseToMinor('', 'INR')).toBe(0);
    expect(parseToMinor('300', 'JPY')).toBe(300);
  });

  it('rejects invalid input', () => {
    expect(parseToMinor('1.234', 'INR')).toBeNull();
    expect(parseToMinor('abc', 'INR')).toBeNull();
    expect(parseToMinor('.', 'INR')).toBeNull();
    expect(parseToMinor('1.5', 'JPY')).toBeNull();
  });

  it('derives currency symbols without formatToParts', () => {
    expect(currencySymbol('INR')).toBe('₹');
    expect(currencySymbol('USD', 'en-US')).toBe('$');
    expect(currencySymbol('EUR', 'en-US')).toBe('€');
  });

  it('formats amounts', () => {
    expect(formatMoney(123456, 'INR')).toBe('₹1,234.56');
    expect(formatMoney(-5000, 'INR', { absolute: true })).toBe('₹50.00');
    expect(formatMoney(1999, 'USD', { locale: 'en-US' })).toBe('$19.99');
  });
});
