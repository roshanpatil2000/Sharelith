// The words of a push, from the recipient's point of view. No Deno APIs, so
// Jest can test it.

export type PushActivity = {
  kind: string;
  actor_name: string | null;
  group_name: string | null;
  description: string | null;
  amount_minor: number | null;
  currency: string | null;
};

export type PushText = { title: string; body: string };

const first = (name: string | null) => name?.split(' ')[0] || 'Someone';

/** "₹1,250.50" from minor units, with the currency's own decimals. */
export function formatMinor(minor: number, currency: string): string {
  const format = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(minor / 10 ** digits);
}

export function pushText(a: PushActivity, net: number): PushText {
  const actor = first(a.actor_name);
  const money = (minor: number) =>
    formatMinor(Math.abs(minor), a.currency ?? 'INR');
  const what = a.description ?? 'An expense';
  const title = a.group_name ? `${what} · ${a.group_name}` : what;
  const owe = (prefix = '') =>
    net > 0
      ? `${prefix}You get back ${money(net)}.`
      : `${prefix}You owe ${money(net)}.`;
  const group = a.group_name ?? 'a group';
  const amount = a.amount_minor ?? Math.abs(net);

  switch (a.kind) {
    case 'expense_added':
      return { title, body: `${actor} added it. ${owe()}` };
    case 'expense_updated':
      return { title, body: `${actor} updated it. ${owe('Now: ')}` };
    case 'expense_deleted':
      return { title, body: `${actor} deleted it.` };
    case 'expense_restored':
      return { title, body: `${actor} restored it. ${owe()}` };
    case 'payment_added':
      // A payer's net goes up; whoever was paid goes down.
      return {
        title: 'Payment',
        body:
          net < 0
            ? `${actor} paid you ${money(amount)}.`
            : `${actor} recorded that you paid them ${money(amount)}.`,
      };
    case 'payment_deleted':
      return {
        title: 'Payment',
        body: `${actor} deleted a payment of ${money(amount)}.`,
      };
    case 'payment_restored':
      return {
        title: 'Payment',
        body: `${actor} restored a payment of ${money(amount)}.`,
      };
    case 'member_added':
      return { title: group, body: `${actor} added you to the group.` };
    case 'member_removed':
      return { title: group, body: `${actor} removed you from the group.` };
    default:
      return { title: 'Sharelith', body: 'Something changed.' };
  }
}
