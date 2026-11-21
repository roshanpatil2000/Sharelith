import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

/** One email of one contact: what Add friend needs. */
export type ContactEmail = { key: string; name: string; email: string };

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
};

/** Every contact with an email, one row per address, sorted by name. */
export function contactEmails(raw: RawContact[]): ContactEmail[] {
  const rows: ContactEmail[] = [];
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
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Rows whose name or email contains the search text. */
export function searchContacts(
  rows: ContactEmail[],
  query: string,
): ContactEmail[] {
  const q = query.trim().toLowerCase();
  return q
    ? rows.filter(r => r.name.toLowerCase().includes(q) || r.email.includes(q))
    : rows;
}

export async function loadContactEmails(): Promise<ContactEmail[]> {
  return contactEmails(await Contacts.getAllWithoutPhotos());
}
