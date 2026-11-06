import { formatMoney } from '@/domain/money';
import type { ActivityItem } from './api';

export type ActivityText = {
  /** "Asha added “Dinner” in Goa". */
  title: string;
  /** Under the amount: "you owe", "you get back", "you paid"… */
  effect: string | null;
  /** Shown with effect; always positive. */
  amount: number | null;
};

const first = (name: string | null) => name?.split(' ')[0] ?? 'Someone';

/**
 * The words for one activity, from your point of view: you are "You", other
 * people go by first name.
 */
export function describeActivity(
  item: ActivityItem,
  me: string | null,
): ActivityText {
  const who = (id: string | null, name: string | null, you = 'You') =>
    id !== null && id === me ? you : first(name);
  const actor = who(item.actor_id, item.actor_name);
  const subject = (you: string) => who(item.subject_id, item.subject_name, you);
  const what = `“${item.description ?? 'an expense'}”`;
  const inGroup = item.group_name ? ` in ${item.group_name}` : '';
  const group = `“${item.group_name ?? 'a group'}”`;
  const money =
    item.amount_minor !== null && item.currency
      ? formatMoney(item.amount_minor, item.currency)
      : '';
  const payment = `${who(item.paid_by, item.payer_name)} paid ${who(
    item.paid_to,
    item.payee_name,
    'you',
  )} ${money}`;

  const net = item.net_minor;
  const owes = {
    effect: net > 0 ? 'you get back' : net < 0 ? 'you owe' : null,
    amount: net !== 0 ? Math.abs(net) : null,
  };
  const none = { effect: null, amount: null };

  switch (item.kind) {
    case 'expense_added':
      return { title: `${actor} added ${what}${inGroup}`, ...owes };
    case 'expense_updated':
      return {
        title: `${actor} updated ${what}${inGroup}`,
        ...(net === 0 ? { effect: 'not involved', amount: null } : owes),
      };
    case 'expense_deleted':
      return { title: `${actor} deleted ${what}${inGroup}`, ...none };
    case 'expense_restored':
      return { title: `${actor} restored ${what}${inGroup}`, ...owes };
    case 'payment_added':
      return {
        title: `${payment}${inGroup}`,
        effect: net > 0 ? 'you paid' : net < 0 ? 'you received' : null,
        amount: null,
      };
    case 'payment_deleted':
      return { title: `${actor} deleted a payment: ${payment}`, ...none };
    case 'payment_restored':
      return { title: `${actor} restored a payment: ${payment}`, ...none };
    case 'group_created':
      return { title: `${actor} created the group ${group}`, ...none };
    case 'member_added':
      return {
        title: `${actor} added ${subject('you')} to ${group}`,
        ...none,
      };
    case 'member_left':
      return { title: `${subject('You')} left ${group}`, ...none };
    case 'member_removed':
      return {
        title: `${actor} removed ${subject('you')} from ${group}`,
        ...none,
      };
  }
}

/** "Today, 3:35 pm", "Yesterday, 9:02 am", "4 Nov, 3:35 pm". */
export function activityTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const day = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) {
    return `Today, ${time}`;
  }
  if (days === 1) {
    return `Yesterday, ${time}`;
  }
  return `${at.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })}, ${time}`;
}
