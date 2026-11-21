import { contactEmails, searchContacts } from '../contacts';
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
