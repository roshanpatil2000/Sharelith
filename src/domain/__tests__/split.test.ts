import {
  allocate,
  remainingToAssign,
  splitByAdjustment,
  splitByPercent,
  splitByShares,
  splitEqually,
  type Shares,
} from '../split';

const sum = (shares: Shares) =>
  Object.values(shares).reduce((a, b) => a + b, 0);

describe('splitEqually', () => {
  it('splits evenly when it divides exactly', () => {
    expect(splitEqually(900, ['a', 'b', 'c'])).toEqual({
      a: 300,
      b: 300,
      c: 300,
    });
  });

  it('gives leftover minor units to the earliest people', () => {
    expect(splitEqually(1000, ['a', 'b', 'c'])).toEqual({
      a: 334,
      b: 333,
      c: 333,
    });
    expect(splitEqually(1001, ['a', 'b', 'c'])).toEqual({
      a: 334,
      b: 334,
      c: 333,
    });
  });

  it('handles totals smaller than the group', () => {
    expect(splitEqually(2, ['a', 'b', 'c'])).toEqual({ a: 1, b: 1, c: 0 });
  });

  it('refuses an empty group', () => {
    expect(() => splitEqually(100, [])).toThrow();
  });

  it('always reconciles, across sizes and awkward totals', () => {
    for (let people = 1; people <= 25; people++) {
      const ids = Array.from({ length: people }, (_, i) => `u${i}`);
      for (const total of [1, 7, 99, 100, 101, 999, 1000003, 99999999999]) {
        const shares = splitEqually(total, ids);
        expect(sum(shares)).toBe(total);
        const values = Object.values(shares);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(
          1,
        );
      }
    }
  });
});

describe('splitByPercent', () => {
  it('splits by percentage', () => {
    expect(splitByPercent(1000, { a: 50, b: 25, c: 25 })).toEqual({
      a: 500,
      b: 250,
      c: 250,
    });
  });

  it('rounds by largest remainder', () => {
    expect(splitByPercent(100, { a: 33.33, b: 33.33, c: 33.34 })).toEqual({
      a: 33,
      b: 33,
      c: 34,
    });
  });

  it('accepts fractions that add up despite floating point', () => {
    expect(splitByPercent(1000, { a: 0.1, b: 0.2, c: 99.7 })).not.toBeNull();
  });

  it('rejects percentages that do not add up to 100', () => {
    expect(splitByPercent(1000, { a: 50, b: 49 })).toBeNull();
    expect(splitByPercent(1000, { a: 50, b: 51 })).toBeNull();
  });
});

describe('splitByShares', () => {
  it('splits by ratio', () => {
    expect(splitByShares(1000, { a: 2, b: 1, c: 1 })).toEqual({
      a: 500,
      b: 250,
      c: 250,
    });
  });

  it('skips people with no shares', () => {
    expect(splitByShares(100, { a: 1, b: 0 })).toEqual({ a: 100, b: 0 });
  });

  it('rounds and reconciles', () => {
    expect(sum(splitByShares(1000, { a: 1, b: 1, c: 1 }))).toBe(1000);
  });
});

describe('splitByAdjustment', () => {
  it('adds adjustments on top of an equal split', () => {
    expect(splitByAdjustment(1000, { a: 100, b: 0, c: 0 })).toEqual({
      a: 400,
      b: 300,
      c: 300,
    });
  });

  it('allows a discount', () => {
    expect(splitByAdjustment(900, { a: -100, b: 0 })).toEqual({
      a: 400,
      b: 500,
    });
  });

  it('reconciles with rounding', () => {
    expect(sum(splitByAdjustment(1000, { a: 7, b: 0, c: 0 })!)).toBe(1000);
  });

  it('rejects adjustments above the total', () => {
    expect(splitByAdjustment(100, { a: 200, b: 0 })).toBeNull();
  });

  it('rejects a discount bigger than someone’s share', () => {
    expect(splitByAdjustment(100, { a: -300, b: 0 })).toBeNull();
  });
});

describe('remainingToAssign', () => {
  it('shows what is left, or the overshoot', () => {
    expect(remainingToAssign(1000, { a: 300 })).toBe(700);
    expect(remainingToAssign(1000, { a: 1200 })).toBe(-200);
    expect(remainingToAssign(1000, { a: 600, b: 400 })).toBe(0);
  });
});

describe('allocate', () => {
  it('breaks ties by listing order, not key sort', () => {
    expect(allocate(1, { z: 1, a: 1 })).toEqual({ z: 1, a: 0 });
  });

  it('refuses all-zero weights', () => {
    expect(() => allocate(100, { a: 0, b: 0 })).toThrow();
  });
});
