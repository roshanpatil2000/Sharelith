import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

/**
 * One way to reach a contact: an email (added as a friend) or, for people
 * with no email, a phone number (invited by text).
 */
export type ContactEntry = {
  key: string;
  name: string;
  email?: string;
  phone?: string;
};

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

/** A dialable number: separators dropped, a leading + kept; null if too short. */
export function cleanPhone(input: string | null | undefined): string | null {
  const trimmed = input?.trim() ?? '';
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return null;
  }
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Every contact's emails, one row each; contacts with no email get one row
 * per phone number instead. Sorted by name.
 */
export function contactEntries(raw: RawContact[]): ContactEntry[] {
  const rows: ContactEntry[] = [];
  for (const c of raw) {
    const name =
      c.displayName?.trim() ||
      [c.givenName, c.familyName].filter(Boolean).join(' ').trim();
    const seen = new Set<string>();
    for (const { email } of c.emailAddresses ?? []) {
      const e = email?.trim().toLowerCase();
      if (e && e.includes('@') && !seen.has(e)) {
        seen.add(e);
        rows.push({ key: `${c.recordID}:${e}`, name: name || e, email: e });
      }
    }
    if (seen.size > 0) {
      continue;
    }
    for (const { number } of c.phoneNumbers ?? []) {
      const phone = cleanPhone(number);
      // The same number saved as "+91 98…" and "98…" is one row.
      const id = phone?.replace(/^\+?91(?=\d{10}$)/, '');
      if (phone && id && !seen.has(id)) {
        seen.add(id);
        rows.push({ key: `${c.recordID}:${id}`, name: name || phone, phone });
      }
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Rows whose name, email or number contains the search text. */
export function searchContacts(
  rows: ContactEntry[],
  query: string,
): ContactEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return rows;
  }
  const digits = q.replace(/[^\d]/g, '');
  return rows.filter(
    r =>
      r.name.toLowerCase().includes(q) ||
      !!r.email?.includes(q) ||
      (digits.length >= 3 && !!r.phone?.replace(/[^\d]/g, '').includes(digits)),
  );
}

export async function loadContacts(): Promise<ContactEntry[]> {
  return contactEntries(await Contacts.getAllWithoutPhotos());
}
