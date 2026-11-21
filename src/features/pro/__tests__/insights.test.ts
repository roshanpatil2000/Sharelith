import { currenciesOf, summarize, type InsightRow } from '../insights';

const row = (o: Partial<InsightRow>): InsightRow => ({
  month: '2026-11-01',
  category: 'food',
  currency: 'INR',
  share_minor: 0,
  paid_minor: 0,
  expense_count: 1,
  ...o,
});
const today = new Date('2026-11-21T10:00:00Z');

it('orders currencies by how much you spent', () => {
  expect(
    currenciesOf([
      row({ currency: 'USD', share_minor: 100 }),
      row({ share_minor: 5000 }),
    ]),
  ).toEqual(['INR', 'USD']);
});

it('makes a bar for every month, empty ones included, oldest first', () => {
  const s = summarize(
    [
      row({ share_minor: 1500 }),
      row({ month: '2026-09-01', share_minor: 700 }),
    ],
    'INR',
    3,
    today,
  );
  expect(s.months.map(m => [m.key, m.share])).toEqual([
    ['2026-09', 700],
    ['2026-10', 0],
    ['2026-11', 1500],
  ]);
  expect(s.months[2]?.label).toBe('Nov');
});

it('totals your share and what you paid, for one currency only', () => {
  const s = summarize(
    [
      row({ share_minor: 1500, paid_minor: 3000 }),
      row({ category: 'transport', share_minor: 500, expense_count: 2 }),
      row({ currency: 'USD', share_minor: 99 }),
    ],
    'INR',
    12,
    today,
  );
  expect(s).toMatchObject({
    totalShare: 2000,
    totalPaid: 3000,
    expenseCount: 3,
  });
});

it('ranks categories by share, with fractions, and maps unknown ones to general', () => {
  const s = summarize(
    [
      row({ share_minor: 1500 }),
      row({ category: 'transport', share_minor: 500 }),
      row({ category: 'weird', share_minor: 0 }),
    ],
    'INR',
    12,
    today,
  );
  expect(s.categories).toEqual([
    { key: 'food', share: 1500, fraction: 0.75 },
    { key: 'transport', share: 500, fraction: 0.25 },
  ]);
});
