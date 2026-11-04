/**
 * Split calculations. Every result reconciles exactly to the total: leftover
 * minor units go out by largest remainder, ties to the earliest person listed.
 */

export type Shares = Record<string, number>;

/** Splits total in proportion to weights. */
export function allocate(total: number, weights: Shares): Shares {
  const ids = Object.keys(weights);
  const sum = ids.reduce((acc, id) => acc + weights[id]!, 0);
  if (ids.length === 0 || sum <= 0) {
    throw new Error('Nothing to split between');
  }
  const exact = ids.map(id => (total * weights[id]!) / sum);
  const result: Shares = {};
  ids.forEach((id, i) => {
    result[id] = Math.floor(exact[i]!);
  });
  const leftover = total - ids.reduce((acc, id) => acc + result[id]!, 0);
  const byRemainder = ids
    .map((id, i) => ({ id, i, remainder: exact[i]! - Math.floor(exact[i]!) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (let n = 0; n < leftover; n++) {
    result[byRemainder[n]!.id]! += 1;
  }
  return result;
}

export function splitEqually(total: number, people: string[]): Shares {
  return allocate(total, Object.fromEntries(people.map(id => [id, 1])));
}

/** Percentages may be fractional, such as 33.33. Must add up to 100. */
export function splitByPercent(total: number, percents: Shares): Shares | null {
  // Compare in hundredths of a percent, so 33.33 + 33.33 + 33.34 is exactly 100.
  const sum = Object.values(percents).reduce(
    (acc, p) => acc + Math.round(p * 100),
    0,
  );
  return sum === 10000 ? allocate(total, percents) : null;
}

/** Shares like 2:1:1. */
export function splitByShares(total: number, shares: Shares): Shares {
  return allocate(total, shares);
}

/**
 * Adds each person's adjustment, then splits what's left equally. Returns null
 * if the adjustments are more than the total.
 */
export function splitByAdjustment(
  total: number,
  adjustments: Shares,
): Shares | null {
  const people = Object.keys(adjustments);
  const remaining =
    total - people.reduce((acc, id) => acc + adjustments[id]!, 0);
  if (remaining < 0 || people.length === 0) {
    return null;
  }
  const equal = splitEqually(remaining, people);
  const result: Shares = {};
  for (const id of people) {
    const owed = equal[id]! + adjustments[id]!;
    if (owed < 0) {
      return null;
    }
    result[id] = owed;
  }
  return result;
}

/** How much of the total is still unassigned; negative means too much. */
export function remainingToAssign(total: number, amounts: Shares): number {
  return total - Object.values(amounts).reduce((acc, a) => acc + a, 0);
}
