import { currencies, currencyLabel, findCurrency } from '../currencies';
import { currencySymbol } from '../money';
import { timezoneLabel, timezoneOptions } from '../timezones';

describe('currencies', () => {
  it('lists INR first with unique, valid codes', () => {
    expect(currencies[0]?.code).toBe('INR');
    const codes = currencies.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    codes.forEach(code => expect(code).toMatch(/^[A-Z]{3}$/));
  });

  it('resolves a symbol for every listed currency', () => {
    currencies.forEach(c => expect(currencySymbol(c.code)).not.toBe(''));
  });

  it('builds labels', () => {
    expect(findCurrency('USD')?.name).toBe('US Dollar');
    expect(currencyLabel('INR')).toBe('₹ Indian Rupee');
    expect(currencyLabel('XYZ')).toBe('XYZ');
    // No distinct symbol: show the name once, not "AED UAE Dirham".
    expect(currencyLabel('AED')).toBe('UAE Dirham');
  });
});

describe('timezones', () => {
  it('labels zones by city', () => {
    expect(timezoneLabel('Asia/Kolkata')).toBe('Kolkata (Asia)');
    expect(timezoneLabel('America/Los_Angeles')).toBe('Los Angeles (America)');
    expect(timezoneLabel('UTC')).toBe('UTC');
  });

  it('includes the current zone even if it is uncommon', () => {
    expect(timezoneOptions('Pacific/Fiji')).toContain('Pacific/Fiji');
    const zones = timezoneOptions();
    expect(new Set(zones).size).toBe(zones.length);
  });
});
