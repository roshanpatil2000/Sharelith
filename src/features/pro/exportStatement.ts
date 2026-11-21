import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { currencyExponent, toMajor } from '@/domain/money';
import type { ExpenseSummary } from '@/features/expenses/api';

/** What a statement is about: a group, or you and one friend. */
export type Statement = {
  title: string;
  expenses: ExpenseSummary[];
  /** Name for a user id; "You" for yourself. */
  nameOf: (id: string) => string;
  generatedAt?: Date;
};

const amount = (minor: number, currency: string) =>
  toMajor(minor, currency).toFixed(currencyExponent(currency));

function rows(s: Statement) {
  return [...s.expenses]
    .filter(e => e.expense_date)
    .sort((a, b) => a.expense_date.localeCompare(b.expense_date))
    .map(e => ({
      date: e.expense_date,
      description: e.description,
      type: e.is_payment ? 'Payment' : 'Expense',
      category: e.is_payment ? '' : e.category,
      paidBy:
        e.payer_count > 1 ? `${e.payer_count} people` : s.nameOf(e.paid_by),
      paidTo: e.paid_to ? s.nameOf(e.paid_to) : '',
      amount: amount(e.amount_minor, e.currency),
      currency: e.currency,
      yours: amount(e.my_net_minor, e.currency),
      e,
    }));
}

/** Your net per currency across the statement: + you're owed, − you owe. */
export function netByCurrency(
  expenses: ExpenseSummary[],
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const e of expenses) {
    net[e.currency] = (net[e.currency] ?? 0) + e.my_net_minor;
  }
  return net;
}

/**
 * Quotes a CSV cell when needed. Text starting with = + - @ could run as a
 * formula in a spreadsheet, so it gets a leading apostrophe; plain numbers
 * (like -5.00) are left alone.
 */
function csvCell(v: string): string {
  const formula = /^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v);
  if (!formula && !/[",\n\r]/.test(v)) {
    return v;
  }
  return `"${(formula ? "'" : '') + v.replace(/"/g, '""')}"`;
}

/** CSV with one row per expense or payment, oldest first. */
export function buildCsv(s: Statement): string {
  const header = [
    'Date',
    'Description',
    'Type',
    'Category',
    'Paid by',
    'Paid to',
    'Amount',
    'Currency',
    'Your share (+ lent / - borrowed)',
  ];
  const lines = rows(s).map(r =>
    [
      r.date,
      r.description,
      r.type,
      r.category,
      r.paidBy,
      r.paidTo,
      r.amount,
      r.currency,
      r.yours,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

/** A simple A4 statement as a base64 PDF. Amounts use currency codes (the built-in PDF fonts have no ₹). */
export async function buildPdf(s: Statement): Promise<string> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Sharelith: ${s.title}`);
  doc.setCreator('Sharelith');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [W, H, M] = [595.28, 841.89, 40];
  const [cDate, cDesc, cPaid, cAmount, cYours] = [
    M,
    M + 62,
    M + 250,
    M + 350,
    M + 440,
  ] as const;
  let page = doc.addPage([W, H]);
  let y = H - M;
  // Standard fonts only encode Latin-1: replace anything else.
  const safe = (t: string) => t.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
  const fit = (t: string, width: number, f = font, size = 9) => {
    let out = safe(t);
    while (out.length > 1 && f.widthOfTextAtSize(out, size) > width) {
      out = out.slice(0, -2) + '.';
    }
    return out;
  };
  const text = (
    t: string,
    x: number,
    f = font,
    size = 9,
    color = rgb(0.1, 0.1, 0.1),
  ) => page.drawText(t, { x, y, size, font: f, color });
  const newPageIfNeeded = () => {
    if (y < M + 20) {
      page = doc.addPage([W, H]);
      y = H - M;
      head();
    }
  };
  const head = () => {
    text('Date', cDate, bold);
    text('Description', cDesc, bold);
    text('Paid by', cPaid, bold);
    text('Amount', cAmount, bold);
    text('Your share', cYours, bold);
    y -= 6;
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= 14;
  };

  text(fit(s.title, W - 2 * M, bold, 18), M, bold, 18);
  y -= 18;
  const when = (s.generatedAt ?? new Date()).toISOString().slice(0, 10);
  text(
    `Sharelith statement, generated ${when}`,
    M,
    font,
    10,
    rgb(0.4, 0.4, 0.4),
  );
  y -= 16;
  for (const [cur, net] of Object.entries(netByCurrency(s.expenses))) {
    const label = net > 0 ? 'You are owed' : net < 0 ? 'You owe' : 'Settled up';
    text(`${label}: ${cur} ${amount(Math.abs(net), cur)}`, M, bold, 11);
    y -= 15;
  }
  y -= 10;
  head();

  for (const r of rows(s)) {
    newPageIfNeeded();
    const desc =
      r.type === 'Payment' ? `Payment to ${r.paidTo}` : r.description;
    text(r.date, cDate);
    text(fit(desc, cPaid - cDesc - 8), cDesc);
    text(fit(r.paidBy, cAmount - cPaid - 8), cPaid);
    text(`${r.currency} ${r.amount}`, cAmount);
    const n = r.e.my_net_minor;
    text(
      n === 0 ? '-' : `${n > 0 ? '+' : ''}${r.yours}`,
      cYours,
      font,
      9,
      n > 0
        ? rgb(0, 0.45, 0.4)
        : n < 0
        ? rgb(0.75, 0.3, 0.1)
        : rgb(0.4, 0.4, 0.4),
    );
    y -= 14;
  }
  if (s.expenses.length === 0) {
    text('No expenses yet.', M);
  }
  return doc.saveAsBase64();
}
