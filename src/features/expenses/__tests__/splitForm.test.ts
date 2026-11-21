import type { ExpenseDetail } from '../api';
import {
  computePayers,
  computeSplit,
  draftFromExpense,
  asDefaultSplit,
  draftFromDefault,
  emptySplit,
  itemsTotal,
  type SplitDraft,
  type SplitType,
} from '../splitForm';

const people = ['a', 'b', 'c'];

const draft = (
  type: SplitType,
  values: Record<string, string> = {},
): SplitDraft => {
  const d = emptySplit();
  d.type = type;
  if (type !== 'equal' && type !== 'itemized') {
    d.values[type] = values;
  }
  return d;
};

describe('computeSplit', () => {
  it('splits equally between whoever is included, in order', () => {
    const d = { ...draft('equal'), excluded: ['b'] };
    const result = computeSplit(1001, 'INR', people, d);
    expect(result.error).toBeNull();
    expect(result.owed).toEqual({ a: 501, b: 0, c: 500 });
    expect(result.rows?.map(r => r.user_id)).toEqual(['a', 'c']);
  });

  it('needs someone included', () => {
    const d = { ...draft('equal'), excluded: people };
    expect(computeSplit(1000, 'INR', people, d).error).toMatch(
      /at least one person/,
    );
  });

  it('takes exact amounts that add up, leaving out zeros', () => {
    const result = computeSplit(
      10000,
      'INR',
      people,
      draft('exact', { a: '30', b: '70' }),
    );
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([
      { user_id: 'a', owed_minor: 3000, split_type: 'exact', raw_value: null },
      { user_id: 'b', owed_minor: 7000, split_type: 'exact', raw_value: null },
    ]);
  });

  it('says how much is left or over for exact amounts', () => {
    expect(
      computeSplit(10000, 'INR', people, draft('exact', { a: '30' })).error,
    ).toBe('₹70.00 left to assign');
    const over = computeSplit(
      10000,
      'INR',
      people,
      draft('exact', { a: '80', b: '30' }),
    );
    expect(over.error).toBe('₹10.00 over the total');
    expect(over.owed).toEqual({ a: 8000, b: 3000, c: 0 });
  });

  it('splits by percent and keeps the percentages', () => {
    const result = computeSplit(
      10000,
      'INR',
      people,
      draft('percent', { a: '33.33', b: '33.33', c: '33.34' }),
    );
    expect(result.error).toBeNull();
    expect(result.owed).toEqual({ a: 3333, b: 3333, c: 3334 });
    expect(result.rows?.[2]).toMatchObject({
      split_type: 'percent',
      raw_value: 33.34,
    });
  });

  it('previews percentages that do not add up yet', () => {
    const result = computeSplit(
      10000,
      'INR',
      people,
      draft('percent', { a: '50', b: '20' }),
    );
    expect(result.error).toBe('30% left to assign');
    expect(result.rows).toBeNull();
    expect(result.owed).toEqual({ a: 5000, b: 2000, c: 0 });
    expect(
      computeSplit(10000, 'INR', people, draft('percent', { a: '120' })).error,
    ).toBe('20% over 100%');
  });

  it('splits by shares', () => {
    const result = computeSplit(
      1000,
      'INR',
      people,
      draft('shares', { a: '2', b: '1', c: '1' }),
    );
    expect(result.owed).toEqual({ a: 500, b: 250, c: 250 });
    expect(result.rows?.[0]).toMatchObject({ raw_value: 2 });
    expect(
      computeSplit(1000, 'INR', people, draft('shares', {})).error,
    ).toMatch(/at least one person a share/);
  });

  it('adds adjustments, including discounts, and keeps them', () => {
    const result = computeSplit(
      90000,
      'INR',
      people,
      draft('adjustment', { a: '150', b: '-60' }),
    );
    expect(result.error).toBeNull();
    // 900 − 90 = 810 split three ways, then +150 / −60.
    expect(result.owed).toEqual({ a: 42000, b: 21000, c: 27000 });
    expect(result.rows?.map(r => r.raw_value)).toEqual([15000, -6000, 0]);
    expect(
      computeSplit(10000, 'INR', people, draft('adjustment', { a: '200' }))
        .error,
    ).toMatch(/more than the total/);
  });

  it('rejects input that is not a number', () => {
    expect(
      computeSplit(1000, 'INR', people, draft('exact', { a: 'abc' })).error,
    ).toMatch(/valid number/);
    expect(
      computeSplit(1000, 'INR', people, draft('percent', { a: '1.234' })).error,
    ).toMatch(/percentages/);
  });

  it('always reconciles exactly when it can be saved', () => {
    for (const total of [1, 99, 1000, 99999, 1000003]) {
      for (const d of [
        draft('equal'),
        draft('percent', { a: '10', b: '45.5', c: '44.5' }),
        draft('shares', { a: '3', b: '1.5', c: '0.25' }),
        draft('adjustment', { a: '0.01' }),
      ]) {
        const { rows } = computeSplit(total, 'INR', people, d);
        if (rows) {
          expect(rows.reduce((s, r) => s + r.owed_minor, 0)).toBe(total);
        }
      }
    }
  });
});

describe('computePayers', () => {
  it('has one payer pay it all', () => {
    expect(
      computePayers(500, 'INR', people, { mode: 'single', id: 'b' }).rows,
    ).toEqual([{ user_id: 'b', paid_minor: 500 }]);
  });

  it('takes several payers that add up', () => {
    expect(
      computePayers(10000, 'INR', people, {
        mode: 'multiple',
        values: { a: '60', c: '40' },
      }).rows,
    ).toEqual([
      { user_id: 'a', paid_minor: 6000 },
      { user_id: 'c', paid_minor: 4000 },
    ]);
  });

  it('says what is unpaid or overpaid', () => {
    expect(
      computePayers(10000, 'INR', people, {
        mode: 'multiple',
        values: { a: '60' },
      }).error,
    ).toBe('₹40.00 of the total still unpaid');
    expect(
      computePayers(10000, 'INR', people, {
        mode: 'multiple',
        values: { a: '60', b: '50' },
      }).error,
    ).toBe('₹10.00 more paid than the total');
  });
});

describe('draftFromExpense', () => {
  const expense = (
    shares: ExpenseDetail['expense_shares'],
    payers: ExpenseDetail['expense_payers'] = [
      { user_id: 'a', paid_minor: 10000 },
    ],
  ): ExpenseDetail => ({
    id: 'e',
    group_id: 'g',
    description: 'X',
    amount_minor: 10000,
    currency: 'INR',
    expense_date: '2026-11-04',
    created_by: 'a',
    expense_payers: payers,
    expense_shares: shares,
  });

  it('restores who was in an equal split', () => {
    const restored = draftFromExpense(
      expense([
        {
          user_id: 'a',
          owed_minor: 5000,
          split_type: 'equal',
          raw_value: null,
        },
        {
          user_id: 'c',
          owed_minor: 5000,
          split_type: 'equal',
          raw_value: null,
        },
      ]),
      people,
    );
    expect(restored?.split).toMatchObject({
      type: 'equal',
      excluded: ['b'],
    });
    expect(restored?.payers).toEqual({ mode: 'single', id: 'a' });
  });

  it('restores what was typed for each split type', () => {
    expect(
      draftFromExpense(
        expense([
          {
            user_id: 'a',
            owed_minor: 2550,
            split_type: 'exact',
            raw_value: null,
          },
          {
            user_id: 'b',
            owed_minor: 7450,
            split_type: 'exact',
            raw_value: null,
          },
        ]),
        people,
      )?.split.values.exact,
    ).toEqual({ a: '25.50', b: '74.50' });
    expect(
      draftFromExpense(
        expense([
          {
            user_id: 'a',
            owed_minor: 6000,
            split_type: 'adjustment',
            raw_value: 1000,
          },
          {
            user_id: 'b',
            owed_minor: 4000,
            split_type: 'adjustment',
            raw_value: -1000,
          },
        ]),
        people,
      )?.split.values.adjustment,
    ).toEqual({ a: '10', b: '-10' });
    expect(
      draftFromExpense(
        expense([
          {
            user_id: 'a',
            owed_minor: 7500,
            split_type: 'shares',
            raw_value: 3,
          },
          {
            user_id: 'b',
            owed_minor: 2500,
            split_type: 'shares',
            raw_value: 1,
          },
        ]),
        people,
      )?.split.values.shares,
    ).toEqual({ a: '3', b: '1' });
  });

  it('restores several payers', () => {
    const restored = draftFromExpense(
      expense(
        [
          {
            user_id: 'a',
            owed_minor: 10000,
            split_type: 'equal',
            raw_value: null,
          },
        ],
        [
          { user_id: 'a', paid_minor: 2500 },
          { user_id: 'b', paid_minor: 7500 },
        ],
      ),
      people,
    );
    expect(restored?.payers).toEqual({
      mode: 'multiple',
      values: { a: '25', b: '75' },
    });
  });

  it('gives up when someone on it is no longer here', () => {
    expect(
      draftFromExpense(
        expense([
          {
            user_id: 'gone',
            owed_minor: 10000,
            split_type: 'equal',
            raw_value: null,
          },
        ]),
        people,
      ),
    ).toBeNull();
  });
});

describe('itemized split', () => {
  const items = (list: [string, string[]][], extra = ''): SplitDraft => ({
    ...emptySplit(),
    type: 'itemized',
    items: list.map(([amount, who], i) => ({
      key: String(i),
      name: `Item ${i + 1}`,
      amount,
      people: who,
    })),
    extra,
  });

  it('shares each item between whoever had it', () => {
    const r = computeSplit(
      90000,
      'INR',
      ['a', 'b', 'c'],
      items([
        ['600', ['a']],
        ['300', ['b', 'c']],
      ]),
    );
    expect(r.error).toBeNull();
    expect(r.owed).toEqual({ a: 60000, b: 15000, c: 15000 });
    expect(r.rows?.every(row => row.split_type === 'exact')).toBe(true);
  });

  it('shares tax or tip in proportion to what each had', () => {
    const r = computeSplit(
      110000,
      'INR',
      ['a', 'b'],
      items(
        [
          ['750', ['a']],
          ['250', ['b']],
        ],
        '100',
      ),
    );
    expect(r.owed).toEqual({ a: 82500, b: 27500 });
  });

  it('says when the items don’t match the total', () => {
    const bill = items([['500', ['a']]]);
    expect(computeSplit(60000, 'INR', ['a', 'b'], bill).error).toBe(
      'Items come to ₹500.00; the total is ₹600.00.',
    );
    expect(itemsTotal(bill, 'INR')).toBe(50000);
  });

  it('asks who had an item', () => {
    const r = computeSplit(50000, 'INR', ['a'], {
      ...items([['500', []]]),
      items: [{ key: '0', name: 'Pizza', amount: '500', people: [] }],
    });
    expect(r.error).toBe('Choose who had “Pizza”.');
  });
});

describe('group default split', () => {
  it('starts the form with its values, 0 for newer members', () => {
    const def = asDefaultSplit({ type: 'percent', values: { a: 60, b: 40 } })!;
    const d = draftFromDefault(def, ['a', 'b', 'c']);
    expect(d.type).toBe('percent');
    expect(d.values.percent).toEqual({ a: '60', b: '40', c: '0' });
  });

  it('ignores anything that isn’t a default split', () => {
    expect(asDefaultSplit(null)).toBeNull();
    expect(asDefaultSplit({ type: 'exact', values: {} })).toBeNull();
  });
});
