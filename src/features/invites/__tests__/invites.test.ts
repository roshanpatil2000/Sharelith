import {
  contactEmails,
  contactPhones,
  normalizePhone,
  searchContacts,
} from '../contacts';
import { inviteMessage, smsUrl, whatsappUrl } from '../sms';
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
  const rows = contactEmails([
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
  ]);

  it('lists one row per distinct email, sorted by name', () => {
    expect(rows.map(r => [r.name, r.email])).toEqual([
      ['Asha K', 'asha@x.co'],
      ['Vikram Rao', 'vikram@mail.com'],
      ['Vikram Rao', 'v@work.in'],
    ]);
  });

  it('searches names and emails', () => {
    expect(searchContacts(rows, 'work').map(r => r.email)).toEqual([
      'v@work.in',
    ]);
    expect(searchContacts(rows, 'ASHA')).toHaveLength(1);
    expect(searchContacts(rows, ' ')).toHaveLength(3);
  });
});

describe('phone invites', () => {
  it('normalizes Indian and international numbers', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('098765-43210')).toBe('+919876543210');
    expect(normalizePhone('91 98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+91 (98765) 43210')).toBe('+919876543210');
    expect(normalizePhone('+1 415 555 0100')).toBe('+14155550100');
    expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
  });

  it('rejects what cannot be a number', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('5876543210')).toBeNull();
    expect(normalizePhone('+12')).toBeNull();
  });

  const phones = contactPhones([
    {
      recordID: '1',
      displayName: 'Vikram Rao',
      phoneNumbers: [
        { number: '98765 43210' },
        { number: '+919876543210' },
        { number: '1800' },
      ],
    },
    {
      recordID: '2',
      givenName: 'Asha',
      phoneNumbers: [{ number: '+1 415 555 0100' }],
    },
  ]);

  it('lists one row per distinct number, sorted by name', () => {
    expect(phones.map(r => [r.name, r.phone])).toEqual([
      ['Asha', '+14155550100'],
      ['Vikram Rao', '+919876543210'],
    ]);
  });

  it('searches numbers by digits', () => {
    expect(searchContacts(phones, '98765').map(r => r.name)).toEqual([
      'Vikram Rao',
    ]);
    expect(searchContacts(phones, 'asha')).toHaveLength(1);
  });

  it('builds SMS and WhatsApp links', () => {
    const body = 'Hi & join: https://x/y?z=1';
    expect(smsUrl('+919876543210', body, 'android')).toBe(
      `sms:+919876543210?body=${encodeURIComponent(body)}`,
    );
    expect(smsUrl('+919876543210', body, 'ios')).toBe(
      `sms:+919876543210&body=${encodeURIComponent(body)}`,
    );
    expect(whatsappUrl('+919876543210', body)).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent(body)}`,
    );
  });

  it('words invites for friends and groups', () => {
    expect(inviteMessage('U')).toBe(
      'Add me on Sharelith so we can split expenses: U',
    );
    expect(inviteMessage('U', 'Goa')).toBe(
      'Join Goa on Sharelith to split expenses: U',
    );
    expect(inviteMessage('U', '')).toBe(
      'Join my group on Sharelith to split expenses: U',
    );
  });
});
