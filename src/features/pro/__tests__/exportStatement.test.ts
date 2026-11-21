import {
  buildCsv,
  buildPdf,
  netByCurrency,
  type Statement,
} from '../exportStatement';
import { fileBase } from '../shareFile';
import type { ExpenseSummary } from '@/features/expenses/api';

const base: ExpenseSummary = {
  id: '1',
  group_id: 'g',
  description: 'Dinner',
  amount_minor: 2000,
  currency: 'INR',
  category: 'food',
  expense_date: '2026-11-02',
  is_payment: false,
  created_by: 'me',
  paid_by: 'me',
  paid_to: null,
  payer_count: 1,
  my_net_minor: 1000,
};
const names: Record<string, string> = { me: 'You', asha: 'Asha' };
const s = (expenses: ExpenseSummary[]): Statement => ({
  title: 'Goa trip',
  expenses,
  nameOf: id => names[id] ?? 'Someone',
  generatedAt: new Date('2026-11-21T00:00:00Z'),
});

describe('buildCsv', () => {
  it('writes one row per expense, oldest first, with your share', () => {
    const csv = buildCsv(
      s([
        {
          ...base,
          id: '2',
          description: 'Taxi',
          expense_date: '2026-11-05',
          paid_by: 'asha',
          my_net_minor: -500,
        },
        base,
      ]),
    );
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toMatch(/^Date,Description,Type/);
    expect(lines[1]).toBe(
      '2026-11-02,Dinner,Expense,food,You,,20.00,INR,10.00',
    );
    expect(lines[2]).toBe('2026-11-05,Taxi,Expense,food,Asha,,20.00,INR,-5.00');
  });

  it('quotes commas and quotes, and neutralises spreadsheet formulas', () => {
    const csv = buildCsv(
      s([
        { ...base, description: 'Rice, "dal"' },
        { ...base, id: '3', description: '=HYPERLINK("x")' },
      ]),
    );
    expect(csv).toContain('"Rice, ""dal"""');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('shows payments with who was paid', () => {
    const csv = buildCsv(
      s([
        { ...base, is_payment: true, paid_to: 'asha', description: 'Payment' },
      ]),
    );
    expect(csv.split('\r\n')[1]).toBe(
      '2026-11-02,Payment,Payment,,You,Asha,20.00,INR,10.00',
    );
  });
});

it('totals your net per currency', () => {
  expect(
    netByCurrency([
      base,
      { ...base, my_net_minor: -300 },
      { ...base, currency: 'USD', my_net_minor: 50 },
    ]),
  ).toEqual({
    INR: 700,
    USD: 50,
  });
});

it('builds a PDF', async () => {
  const b64 = await buildPdf(
    s([base, { ...base, id: '2', description: 'Chai ₹ ☕' }]),
  );
  expect(atob(b64).slice(0, 5)).toBe('%PDF-');
});

it('makes safe file names', () => {
  expect(fileBase('Goa trip 2026!')).toBe('Sharelith-Goa-trip-2026');
  expect(fileBase('★★★')).toBe('Sharelith-statement');
});
