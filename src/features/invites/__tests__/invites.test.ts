import { Platform } from 'react-native';
import { cleanPhone, contactEntries, searchContacts } from '../contacts';
import { smsComposerUrl, smsInviteText } from '../sms';
import {
  captureInviteLink,
  inviteUrl,
  parseInviteLink,
  useInviteStore,
} from '../links';

const token = 'AbC-123_xyzQWERTYuiop';

describe('invite links', () => {
  it('reads the token from the website and app links', () => {
    expect(parseInviteLink(inviteUrl(token))).toBe(token);
    expect(parseInviteLink(`sharelith://invite/${token}`)).toBe(token);
    expect(parseInviteLink(`${inviteUrl(token)}/?utm=x`)).toBe(token);
  });

  it('ignores other links', () => {
    expect(parseInviteLink('sharelith://auth/callback?code=1')).toBeNull();
    expect(parseInviteLink('https://evil.example/invite/' + token)).toBeNull();
    expect(parseInviteLink(inviteUrl('short'))).toBeNull();
  });

  it('keeps an opened invite until it is used', () => {
    expect(captureInviteLink('sharelith://auth/callback?code=1')).toBe(false);
    expect(useInviteStore.getState().pendingToken).toBeNull();
    expect(captureInviteLink(inviteUrl(token))).toBe(true);
    expect(useInviteStore.getState().pendingToken).toBe(token);
    useInviteStore.getState().setPendingToken(null);
  });
});

describe('contacts', () => {
  const rows = contactEntries([
    {
      recordID: '1',
      displayName: 'Vikram Rao',
      emailAddresses: [
        { email: 'Vikram@Mail.com ' },
        { email: 'vikram@mail.com' },
        { email: 'not-an-email' },
        { email: 'v@work.in' },
      ],
    },
    {
      recordID: '2',
      givenName: 'Asha',
      familyName: 'K',
      emailAddresses: [{ email: 'asha@x.co' }],
    },
    { recordID: '3', displayName: 'No email', emailAddresses: [] },
    {
      recordID: '4',
      displayName: 'Ravi Phone',
      phoneNumbers: [
        { number: '+91 98765-43210' },
        { number: '98765 43210' },
        { number: '12' },
        { number: '022 2345 6789' },
      ],
    },
    {
      recordID: '5',
      displayName: 'Both Ways',
      emailAddresses: [{ email: 'both@x.co' }],
      phoneNumbers: [{ number: '+91 90000 00000' }],
    },
  ]);

  it('lists emails, and numbers only for people with no email', () => {
    expect(rows.map(r => [r.name, r.email ?? r.phone])).toEqual([
      ['Asha K', 'asha@x.co'],
      ['Both Ways', 'both@x.co'],
      ['Ravi Phone', '+919876543210'],
      ['Ravi Phone', '02223456789'],
      ['Vikram Rao', 'vikram@mail.com'],
      ['Vikram Rao', 'v@work.in'],
    ]);
  });

  it('cleans numbers and drops ones too short to dial', () => {
    expect(cleanPhone(' +1 (555) 123-4567 ')).toBe('+15551234567');
    expect(cleanPhone('12345')).toBeNull();
    expect(cleanPhone(undefined)).toBeNull();
  });

  it('searches names and emails', () => {
    expect(searchContacts(rows, 'work').map(r => r.email)).toEqual([
      'v@work.in',
    ]);
    expect(searchContacts(rows, 'ASHA')).toHaveLength(1);
    expect(searchContacts(rows, ' ')).toHaveLength(6);
  });

  it('searches numbers, ignoring spaces and dashes', () => {
    expect(searchContacts(rows, '98765 432').map(r => r.phone)).toEqual([
      '+919876543210',
    ]);
  });
});

describe('text invites', () => {
  const body = smsInviteText(
    'Asha',
    'https://sharelith.techbeas.co.in/invite/abc',
  );

  it('words the invite with the link', () => {
    expect(body).toBe(
      'Asha invited you to split costs on Sharelith: https://sharelith.techbeas.co.in/invite/abc',
    );
  });

  it.each([
    ['ios', '&'],
    ['android', '?'],
  ] as const)(
    'builds a Messages link for %s with the text encoded',
    (os, sep) => {
      const original = Platform.OS;
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
      try {
        expect(smsComposerUrl('+91 98765-43210', 'Hi & bye?')).toBe(
          `sms:+919876543210${sep}body=Hi%20%26%20bye%3F`,
        );
      } finally {
        Object.defineProperty(Platform, 'OS', {
          value: original,
          configurable: true,
        });
      }
    },
  );
});
