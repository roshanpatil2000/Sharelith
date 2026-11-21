import { fold, nameMatches } from '../api';

describe('name matching', () => {
  it('ignores case, spaces and accents', () => {
    expect(fold('  Zoë ')).toBe('zoe');
    expect(nameMatches('Asha Rao', 'RAO')).toBe(true);
    expect(nameMatches('José', 'jose')).toBe(true);
    expect(nameMatches('Goa trip', 'pune')).toBe(false);
  });
});
