import type { ActivityItem } from '../api';
import { activityTime, describeActivity } from '../describe';

const me = 'me';

const item = (overrides: Partial<ActivityItem>): ActivityItem => ({
  id: 1,
  kind: 'expense_added',
  created_at: '2026-11-04T10:00:00Z',
  actor_id: 'asha',
  actor_name: 'Asha Rao',
  subject_id: null,
  subject_name: null,
  group_id: 'g',
  group_name: 'Goa',
  expense_id: 'e',
  description: 'Dinner',
  amount_minor: 90000,
  currency: 'INR',
  net_minor: -30000,
  paid_by: null,
  payer_name: null,
  paid_to: null,
  payee_name: null,
  ...overrides,
});

describe('describeActivity', () => {
  it('says who added an expense and what you owe', () => {
    expect(describeActivity(item({}), me)).toEqual({
      title: 'Asha added “Dinner” in Goa',
      effect: 'you owe',
      amount: 30000,
    });
  });

  it('calls you "You", and says what you get back', () => {
    expect(
      describeActivity(item({ actor_id: me, net_minor: 60000 }), me),
    ).toEqual({
      title: 'You added “Dinner” in Goa',
      effect: 'you get back',
      amount: 60000,
    });
  });

  it('leaves out the group for expenses outside one', () => {
    expect(
      describeActivity(item({ group_id: null, group_name: null }), me).title,
    ).toBe('Asha added “Dinner”');
  });

  it('says when an edit no longer involves you', () => {
    expect(
      describeActivity(item({ kind: 'expense_updated', net_minor: 0 }), me),
    ).toMatchObject({ effect: 'not involved', amount: null });
  });

  it('shows no amount for a deleted expense', () => {
    expect(describeActivity(item({ kind: 'expense_deleted' }), me)).toEqual({
      title: 'Asha deleted “Dinner” in Goa',
      effect: null,
      amount: null,
    });
  });

  it('says who paid whom', () => {
    const payment = item({
      kind: 'payment_added',
      description: 'Payment',
      amount_minor: 18000,
      paid_by: 'asha',
      payer_name: 'Asha Rao',
      paid_to: me,
      payee_name: 'Me Myself',
      net_minor: -18000,
    });
    expect(describeActivity(payment, me)).toEqual({
      title: 'Asha paid you ₹180.00 in Goa',
      effect: 'you received',
      amount: null,
    });
    expect(
      describeActivity({ ...payment, kind: 'payment_deleted' }, me).title,
    ).toBe('Asha deleted a payment: Asha paid you ₹180.00');
  });

  it('describes group changes, with "you" when it is about you', () => {
    const member = item({
      kind: 'member_added',
      expense_id: null,
      subject_id: 'vik',
      subject_name: 'Vikram Shah',
      net_minor: 0,
    });
    expect(describeActivity(member, me).title).toBe(
      'Asha added Vikram to “Goa”',
    );
    expect(describeActivity({ ...member, subject_id: me }, me).title).toBe(
      'Asha added you to “Goa”',
    );
    expect(describeActivity({ ...member, kind: 'member_left' }, me).title).toBe(
      'Vikram left “Goa”',
    );
    expect(
      describeActivity({ ...member, kind: 'member_removed' }, me).title,
    ).toBe('Asha removed Vikram from “Goa”');
    expect(
      describeActivity({ ...member, kind: 'group_created' }, me).title,
    ).toBe('Asha created the group “Goa”');
  });
});

describe('activityTime', () => {
  const now = new Date(2026, 10, 4, 18, 0);

  it('says today and yesterday, otherwise the date', () => {
    expect(
      activityTime(new Date(2026, 10, 4, 15, 35).toISOString(), now),
    ).toMatch(/^Today, 3:35/);
    expect(
      activityTime(new Date(2026, 10, 3, 9, 2).toISOString(), now),
    ).toMatch(/^Yesterday, 9:02/);
    expect(
      activityTime(new Date(2026, 9, 28, 9, 2).toISOString(), now),
    ).toMatch(/^28 Oct, 9:02/);
    expect(
      activityTime(new Date(2025, 9, 28, 9, 2).toISOString(), now),
    ).toMatch(/^28 Oct 2025, 9:02/);
  });
});
