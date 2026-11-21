/**
 * The Add expense form's split and payer choices: what was typed, turned into
 * the rows create_expense and update_expense take, or a reason it can't be
 * saved yet. The arithmetic itself lives in src/domain/split.ts.
 */
import {
  formatMoney,
  minorToInput,
  parseSignedToMinor,
  parseToMinor,
} from '@/domain/money';
import {
  allocate,
  splitByAdjustment,
  splitByPercent,
  splitByShares,
  splitEqually,
  type Shares,
} from '@/domain/split';
import type { ExpenseDetail, PayerRow, ShareRow } from './api';

export type SplitType =
  | 'equal'
  | 'exact'
  | 'percent'
  | 'shares'
  | 'adjustment'
  | 'itemized';

/** How a split is saved: itemized is worked out here and saved as exact. */
type SavedSplitType = Exclude<SplitType, 'itemized'>;

export const SPLIT_TYPES: readonly { value: SplitType; label: string }[] = [
  { value: 'equal', label: 'Equal' },
  { value: 'exact', label: 'Exact' },
  { value: 'percent', label: '%' },
  { value: 'shares', label: 'Shares' },
  { value: 'adjustment', label: '+/−' },
  { value: 'itemized', label: 'Items' },
];

/** One line of an itemized bill: its price and who had it (shared equally). */
export type ItemDraft = {
  key: string;
  name: string;
  amount: string;
  people: string[];
};

/** What was typed per person, for each split type, so switching keeps it. */
export type SplitDraft = {
  type: SplitType;
  /** For equal: who's left out. Everyone else is in, even people still loading. */
  excluded: string[];
  values: Record<
    Exclude<SplitType, 'equal' | 'itemized'>,
    Record<string, string>
  >;
  items: ItemDraft[];
  /** Tax, tip or service charge: shared in proportion to what each had. */
  extra: string;
};

export type PayerDraft =
  | { mode: 'single'; id: string }
  | { mode: 'multiple'; values: Record<string, string> };

export const emptySplit = (): SplitDraft => ({
  type: 'equal',
  excluded: [],
  values: { exact: {}, percent: {}, shares: {}, adjustment: {} },
  items: [],
  extra: '',
});

/** A group's default split, as saved on the group. */
export type DefaultSplit = {
  type: 'percent' | 'shares';
  values: Record<string, number>;
};

/** Reads a group's saved default; anything unexpected counts as none. */
export function asDefaultSplit(value: unknown): DefaultSplit | null {
  const v = value as Partial<DefaultSplit> | null;
  return v &&
    (v.type === 'percent' || v.type === 'shares') &&
    v.values &&
    typeof v.values === 'object'
    ? (v as DefaultSplit)
    : null;
}

/**
 * The form's starting split for a group with a default: its percentages or
 * shares for current members (0 for anyone added since).
 */
export function draftFromDefault(
  def: DefaultSplit,
  people: string[],
): SplitDraft {
  const draft = emptySplit();
  draft.type = def.type;
  draft.values[def.type] = Object.fromEntries(
    people.map(id => [id, String(def.values[id] ?? 0)]),
  );
  return draft;
}

/** What the items and extra add up to, or null if one isn't a number. */
export function itemsTotal(draft: SplitDraft, currency: string): number | null {
  let sum = 0;
  for (const item of draft.items) {
    const minor = parseToMinor(item.amount, currency);
    if (minor === null) {
      return null;
    }
    sum += minor;
  }
  const extra = parseToMinor(draft.extra, currency);
  return extra === null ? null : sum + extra;
}

/**
 * owed is always filled in as far as it can be worked out, so the form can show
 * each person's amount while the input is still incomplete.
 */
export type SplitResult = {
  owed: Shares;
  rows: ShareRow[] | null;
  error: string | null;
};

/** Up to two decimals, no sign: "33.33", "2". Empty is 0. */
function parseNumber(text: string | undefined): number | null {
  const cleaned = (text ?? '').trim();
  if (cleaned === '') {
    return 0;
  }
  return /^\d*(\.\d{0,2})?$/.test(cleaned) && cleaned !== '.'
    ? Number(cleaned)
    : null;
}

const percentText = (hundredths: number) =>
  `${Number((Math.abs(hundredths) / 100).toFixed(2))}%`;

/** "₹20.00 left to assign" / "₹20.00 over the total". */
function remainingMessage(left: number, currency: string): string {
  return left > 0
    ? `${formatMoney(left, currency)} left to assign`
    : `${formatMoney(-left, currency)} over the total`;
}

function rowsFrom(
  type: SavedSplitType,
  people: string[],
  owed: Shares,
  raw: (id: string) => number | null,
  keep: (id: string) => boolean,
): ShareRow[] {
  return people.filter(keep).map(id => ({
    user_id: id,
    owed_minor: owed[id] ?? 0,
    split_type: type,
    raw_value: raw(id),
  }));
}

export function computeSplit(
  total: number,
  currency: string,
  people: string[],
  draft: SplitDraft,
): SplitResult {
  const zero = Object.fromEntries(people.map(id => [id, 0]));
  const fail = (error: string, owed: Shares = zero): SplitResult => ({
    owed,
    rows: null,
    error,
  });

  if (draft.type === 'equal') {
    const included = people.filter(id => !draft.excluded.includes(id));
    if (included.length === 0) {
      return fail('Choose at least one person to split with.');
    }
    const owed = { ...zero, ...splitEqually(Math.max(total, 0), included) };
    return {
      owed,
      rows: rowsFrom(
        'equal',
        people,
        owed,
        () => null,
        id => included.includes(id),
      ),
      error: null,
    };
  }

  if (draft.type === 'itemized') {
    return computeItemized(total, currency, people, draft, zero, fail);
  }

  const typed = draft.values[draft.type];

  if (draft.type === 'exact') {
    const owed: Shares = {};
    for (const id of people) {
      const minor = parseToMinor(typed[id] ?? '', currency);
      if (minor === null) {
        return fail('Check the amounts: one isn’t a valid number.');
      }
      owed[id] = minor;
    }
    const left = total - people.reduce((sum, id) => sum + owed[id]!, 0);
    if (left !== 0) {
      return fail(remainingMessage(left, currency), owed);
    }
    return {
      owed,
      rows: rowsFrom(
        'exact',
        people,
        owed,
        () => null,
        id => owed[id]! > 0,
      ),
      error: null,
    };
  }

  if (draft.type === 'adjustment') {
    const adjustments: Shares = {};
    for (const id of people) {
      const minor = parseSignedToMinor(typed[id] ?? '', currency);
      if (minor === null) {
        return fail('Check the adjustments: one isn’t a valid amount.');
      }
      adjustments[id] = minor;
    }
    const owed = splitByAdjustment(Math.max(total, 0), adjustments);
    if (!owed) {
      return fail('The adjustments add up to more than the total.');
    }
    return {
      owed,
      rows: rowsFrom(
        'adjustment',
        people,
        owed,
        id => adjustments[id]!,
        id => owed[id]! > 0 || adjustments[id] !== 0,
      ),
      error: null,
    };
  }

  const numbers: Shares = {};
  for (const id of people) {
    const value = parseNumber(typed[id]);
    if (value === null) {
      return fail(
        draft.type === 'percent'
          ? 'Check the percentages: use numbers like 25 or 33.33.'
          : 'Check the shares: use numbers like 1 or 2.5.',
      );
    }
    numbers[id] = value;
  }
  const sum = people.reduce((acc, id) => acc + numbers[id]!, 0);
  const keep = (id: string) => numbers[id]! > 0;

  if (draft.type === 'percent') {
    const hundredths = people.reduce(
      (acc, id) => acc + Math.round(numbers[id]! * 100),
      0,
    );
    if (hundredths !== 10000) {
      // A guide while typing: each percentage of the total, unrounded split.
      const preview = Object.fromEntries(
        people.map(id => [
          id,
          Math.round((Math.max(total, 0) * numbers[id]!) / 100),
        ]),
      );
      return fail(
        hundredths < 10000
          ? `${percentText(10000 - hundredths)} left to assign`
          : `${percentText(hundredths - 10000)} over 100%`,
        preview,
      );
    }
    const owed = splitByPercent(Math.max(total, 0), numbers)!;
    return {
      owed,
      rows: rowsFrom('percent', people, owed, id => numbers[id]!, keep),
      error: null,
    };
  }

  if (sum <= 0) {
    return fail('Give at least one person a share.');
  }
  const owed = splitByShares(Math.max(total, 0), numbers);
  return {
    owed,
    rows: rowsFrom('shares', people, owed, id => numbers[id]!, keep),
    error: null,
  };
}

function computeItemized(
  total: number,
  currency: string,
  people: string[],
  draft: SplitDraft,
  zero: Shares,
  fail: (error: string, owed?: Shares) => SplitResult,
): SplitResult {
  if (draft.items.length === 0) {
    return fail('Add the items on the bill.');
  }
  const subtotal: Shares = { ...zero };
  for (const item of draft.items) {
    const label = item.name.trim() ? `“${item.name.trim()}”` : 'an item';
    const minor = parseToMinor(item.amount, currency);
    if (minor === null) {
      return fail(`Check the price of ${label}.`);
    }
    const who = item.people.filter(id => people.includes(id));
    if (minor > 0 && who.length === 0) {
      return fail(`Choose who had ${label}.`);
    }
    if (minor > 0) {
      for (const [id, part] of Object.entries(splitEqually(minor, who))) {
        subtotal[id] = (subtotal[id] ?? 0) + part;
      }
    }
  }
  const extra = parseToMinor(draft.extra, currency);
  if (extra === null) {
    return fail('Check the tax or tip: it isn’t a valid amount.');
  }
  const itemsSum = people.reduce((acc, id) => acc + subtotal[id]!, 0);
  if (itemsSum === 0) {
    return fail('Add a price to at least one item.');
  }
  const owed: Shares = { ...subtotal };
  if (extra > 0) {
    const shared = allocate(extra, subtotal);
    for (const id of people) {
      owed[id] = (owed[id] ?? 0) + (shared[id] ?? 0);
    }
  }
  const left = total - (itemsSum + extra);
  if (left !== 0) {
    return fail(
      `Items come to ${formatMoney(
        itemsSum + extra,
        currency,
      )}; the total is ${formatMoney(total, currency)}.`,
      owed,
    );
  }
  return {
    owed,
    rows: rowsFrom(
      'exact',
      people,
      owed,
      () => null,
      id => owed[id]! > 0,
    ),
    error: null,
  };
}

export type PayerResult = {
  rows: PayerRow[] | null;
  error: string | null;
};

export function computePayers(
  total: number,
  currency: string,
  people: string[],
  draft: PayerDraft,
): PayerResult {
  if (draft.mode === 'single') {
    return {
      rows: [{ user_id: draft.id, paid_minor: total }],
      error: null,
    };
  }
  const paid: Shares = {};
  for (const id of people) {
    const minor = parseToMinor(draft.values[id] ?? '', currency);
    if (minor === null) {
      return {
        rows: null,
        error: 'Check who paid what: one amount isn’t valid.',
      };
    }
    paid[id] = minor;
  }
  const left = total - people.reduce((sum, id) => sum + paid[id]!, 0);
  if (left !== 0) {
    return {
      rows: null,
      error:
        left > 0
          ? `${formatMoney(left, currency)} of the total still unpaid`
          : `${formatMoney(-left, currency)} more paid than the total`,
    };
  }
  return {
    rows: people
      .filter(id => paid[id]! > 0)
      .map(id => ({ user_id: id, paid_minor: paid[id]! })),
    error: null,
  };
}

// Itemized is never saved as such, so a saved split is never "itemized".
const isSplitType = (t: string): t is SavedSplitType =>
  t !== 'itemized' && SPLIT_TYPES.some(s => s.value === t);

/**
 * The form's choices for a saved expense, or null if this form can't show it:
 * someone on it has left, or its shares mix split types.
 */
export function draftFromExpense(
  expense: ExpenseDetail,
  people: string[],
): { split: SplitDraft; payers: PayerDraft } | null {
  const { currency } = expense;
  const everyone = [
    ...expense.expense_payers.map(p => p.user_id),
    ...expense.expense_shares.map(s => s.user_id),
  ];
  const type = expense.expense_shares[0]?.split_type ?? 'equal';
  if (
    everyone.some(id => !people.includes(id)) ||
    !isSplitType(type) ||
    expense.expense_shares.some(s => s.split_type !== type)
  ) {
    return null;
  }

  const split = emptySplit();
  split.type = type;
  if (type === 'equal') {
    const sharers = expense.expense_shares.map(s => s.user_id);
    split.excluded = people.filter(id => !sharers.includes(id));
  } else {
    split.values[type] = Object.fromEntries(
      expense.expense_shares.map(s => [
        s.user_id,
        type === 'exact'
          ? minorToInput(s.owed_minor, currency)
          : type === 'adjustment'
          ? minorToInput(s.raw_value ?? 0, currency)
          : s.raw_value === null
          ? ''
          : String(s.raw_value),
      ]),
    );
  }

  const payers: PayerDraft =
    expense.expense_payers.length === 1
      ? { mode: 'single', id: expense.expense_payers[0]!.user_id }
      : {
          mode: 'multiple',
          values: Object.fromEntries(
            expense.expense_payers.map(p => [
              p.user_id,
              minorToInput(p.paid_minor, currency),
            ]),
          ),
        };
  return { split, payers };
}
