import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

/** One email of one contact: what Add friend needs. */
export type ContactEmail = { key: string; name: string; email: string };

/** One phone number of one contact: what an SMS invite needs. */
export type ContactPhone = { key: string; name: string; phone: string };

/** Whether contacts can be read already, without asking. */
export async function hasContactsAccess(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    );
  }
  const result = await Contacts.checkPermission();
  return result === 'authorized' || result === 'limited';
}

/** Asks for contacts access; true if allowed (fully or in part). */
export async function allowContacts(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await Contacts.requestPermission();
  return result === 'authorized' || result === 'limited';
}

type RawContact = {
  recordID: string;
  displayName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  emailAddresses?: { email?: string | null }[];
  phoneNumbers?: { number?: string | null }[];
};

const nameOf = (c: RawContact) =>
  c.displayName?.trim() ||
  [c.givenName, c.familyName].filter(Boolean).join(' ').trim();

/**
 * A phone number in international form, or null if it can't be one.
 * Bare Indian mobiles (10 digits, starting 6-9, maybe after 0 or 91) get +91;
 * numbers already starting with + are kept.
 */
export function normalizePhone(
  input: string | null | undefined,
): string | null {
  const raw = input?.trim() ?? '';
  const plus = raw.startsWith('+') || raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (plus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  digits = digits.replace(/^0+/, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** Every contact with an email, one row per address, sorted by name. */
export function contactEmails(raw: RawContact[]): ContactEmail[] {
  const rows: ContactEmail[] = [];
  for (const c of raw) {
    const name = nameOf(c);
    const seen = new Set<string>();
    for (const { email } of c.emailAddresses ?? []) {
      const e = email?.trim().toLowerCase();
      if (e && e.includes('@') && !seen.has(e)) {
        seen.add(e);
        rows.push({ key: `${c.recordID}:${e}`, name: name || e, email: e });
      }
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Every contact with a usable phone number, one row per number, by name. */
export function contactPhones(raw: RawContact[]): ContactPhone[] {
  const rows: ContactPhone[] = [];
  for (const c of raw) {
    const name = nameOf(c);
    const seen = new Set<string>();
    for (const { number } of c.phoneNumbers ?? []) {
      const phone = normalizePhone(number);
      if (phone && !seen.has(phone)) {
        seen.add(phone);
        rows.push({
          key: `${c.recordID}:${phone}`,
          name: name || phone,
          phone,
        });
      }
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** A contact row: an email to add, or a phone number to invite. */
export type ContactRow = ContactEmail | ContactPhone;

/** Rows whose name, email or number contains the search text. */
export function searchContacts<T extends ContactRow>(
  rows: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return rows;
  }
  const digits = q.replace(/\D/g, '');
  return rows.filter(
    r =>
      r.name.toLowerCase().includes(q) ||
      ('email' in r
        ? r.email.includes(q)
        : !!digits && r.phone.replace(/\D/g, '').includes(digits)),
  );
}

/** Emails and phone numbers of every contact, sorted by name. */
export async function loadContactRows(): Promise<ContactRow[]> {
  const raw = await Contacts.getAllWithoutPhotos();
  return [...contactEmails(raw), ...contactPhones(raw)].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}
