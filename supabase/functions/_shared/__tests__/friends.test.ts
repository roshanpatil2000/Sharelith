import {
  buildFriendAddedEmail,
  normalizeEmail,
  normalizeName,
  orderedPair,
} from '../friends';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Asha.Rao@Example.COM ')).toBe(
      'asha.rao@example.com',
    );
  });

  it.each([undefined, 42, '', 'asha', 'a@b', 'a b@c.com', 'a@b.c'])(
    'rejects %p',
    value => {
      expect(normalizeEmail(value)).toBeNull();
    },
  );

  it('rejects overly long addresses', () => {
    expect(normalizeEmail(`${'a'.repeat(250)}@x.com`)).toBeNull();
  });
});

describe('normalizeName', () => {
  it('collapses whitespace', () => {
    expect(normalizeName('  Asha   Rao ')).toBe('Asha Rao');
  });
  it.each([undefined, '', '   ', 'x'.repeat(101)])('rejects %p', value => {
    expect(normalizeName(value)).toBeNull();
  });
});

describe('orderedPair', () => {
  it('always puts the smaller id first', () => {
    expect(orderedPair('b', 'a')).toEqual(['a', 'b']);
    expect(orderedPair('a', 'b')).toEqual(['a', 'b']);
  });
});

describe('buildFriendAddedEmail', () => {
  it('names the adder and uses the Friend Added category', () => {
    const email = buildFriendAddedEmail('Roshan Patil', 'Asha');
    expect(email.subject).toBe(
      'Roshan Patil added you as a friend on Sharelith',
    );
    expect(email.category).toBe('Friend Added');
    expect(email.text).toContain('Hi Asha,');
  });

  it('escapes names in HTML', () => {
    const email = buildFriendAddedEmail('<script>x</script>', 'A&B');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('A&amp;B');
  });
});
