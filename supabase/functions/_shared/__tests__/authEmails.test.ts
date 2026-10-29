import { buildAuthEmail, confirmationUrl, type EmailData } from '../authEmails';

const SUPABASE = 'https://byinhavevmzabiihryja.supabase.co';
const base: EmailData = {
  token: '123456',
  token_hash: 'pkce_abc123',
  redirect_to: 'https://sharelith.techbeas.co.in/auth/callback?next=verify',
  email_action_type: 'signup',
  site_url: 'https://sharelith.techbeas.co.in',
};

describe('buildAuthEmail', () => {
  it.each([
    ['signup', 'Confirm your email address', 'Email Confirmation'],
    ['magiclink', 'Confirm your email address', 'Email Verification'],
    ['recovery', 'Reset your Sharelith password', 'Password Reset'],
    ['email_change', 'Confirm your new email address', 'Email Change'],
    ['invite', 'You’ve been invited to Sharelith', 'Invite'],
    [
      'reauthentication',
      'Your Sharelith verification code',
      'Reauthentication',
    ],
    ['something_new', 'A message from Sharelith', 'Account Notification'],
  ])('%s → "%s" in category "%s"', (type, subject, category) => {
    const email = buildAuthEmail(SUPABASE, {
      ...base,
      email_action_type: type,
    });
    expect(email.subject).toBe(subject);
    expect(email.category).toBe(category);
  });

  it('includes both the link and the 6-digit code', () => {
    const email = buildAuthEmail(SUPABASE, base);
    const link = confirmationUrl(SUPABASE, base);
    expect(email.text).toContain(link);
    expect(email.text).toContain('123456');
    expect(email.html).toContain('123456');
    // & in the URL must be escaped inside the HTML attribute.
    expect(email.html).toContain(link.replace(/&/g, '&amp;'));
  });

  it('code-only emails have no link', () => {
    const email = buildAuthEmail(SUPABASE, {
      ...base,
      email_action_type: 'reauthentication',
    });
    expect(email.text).not.toContain('/auth/v1/verify');
    expect(email.html).not.toContain('<a ');
    expect(email.text).toContain('123456');
  });

  it('escapes HTML in values', () => {
    const email = buildAuthEmail(SUPABASE, { ...base, token: '<b>1</b>' });
    expect(email.html).not.toContain('<b>1</b>');
    expect(email.html).toContain('&lt;b&gt;1&lt;/b&gt;');
  });
});

describe('confirmationUrl', () => {
  it('matches the format Supabase sends today', () => {
    expect(confirmationUrl(`${SUPABASE}/`, base)).toBe(
      `${SUPABASE}/auth/v1/verify?token=pkce_abc123&type=signup&redirect_to=` +
        encodeURIComponent(base.redirect_to),
    );
  });

  it('falls back to the site URL when there is no redirect', () => {
    const url = new URL(
      confirmationUrl(SUPABASE, { ...base, redirect_to: '' }),
    );
    expect(url.searchParams.get('redirect_to')).toBe(base.site_url);
  });
});
