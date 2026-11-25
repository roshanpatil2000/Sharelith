import { describeRevision, type ExpenseRevision } from '../history';

const snap = {
  description: 'Dinner',
  amount_minor: 50000,
  currency: 'INR',
  category: 'food',
  expense_date: '2026-11-20',
  notes: null as string | null,
  payers: [{ user_id: 'a', paid_minor: 50000 }],
  shares: [
    { user_id: 'a', owed_minor: 25000 },
    { user_id: 'b', owed_minor: 25000 },
  ],
};

const rev = (after: Partial<typeof snap>, editor = 'a'): ExpenseRevision => ({
  id: 'r',
  edited_at: '2026-11-21T10:00:00Z',
  editor_id: editor,
  editor_name: 'Asha',
  before: snap,
  after: { ...snap, ...after },
  names: {},
});

describe('describeRevision', () => {
  it('says You for your own edit', () => {
    expect(describeRevision(rev({ notes: 'hi' }), 'a')).toBe(
      'You changed notes',
    );
  });

  it('names the editor otherwise', () => {
    expect(describeRevision(rev({ notes: 'hi' }), 'z')).toBe(
      'Asha changed notes',
    );
  });

  it('lists several changes', () => {
    expect(
      describeRevision(
        rev({
          description: 'Lunch',
          amount_minor: 60000,
          payers: [{ user_id: 'a', paid_minor: 60000 }],
          shares: [
            { user_id: 'a', owed_minor: 30000 },
            { user_id: 'b', owed_minor: 30000 },
          ],
        }),
        'z',
      ),
    ).toBe(
      'Asha changed description “Dinner” → “Lunch”, amount ₹500.00 → ₹600.00, who paid and the split',
    );
  });

  it('ignores the order people come in', () => {
    expect(
      describeRevision(rev({ shares: [...snap.shares].reverse() }), 'z'),
    ).toBe('Asha edited this expense');
  });
});
