import { CATEGORY_KEYWORDS, guessCategory } from '../categorize';

describe('guessCategory', () => {
  it('maps every keyword in the table to its own category', () => {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const k of keywords) {
        // tickets/ticket rows: the single word belongs to Entertainment only.
        expect([k, guessCategory(k)]).toEqual([k, category]);
      }
    }
  });

  it('works inside longer descriptions, any case', () => {
    expect(guessCategory('Dinner at Taj')).toBe('food');
    expect(guessCategory('UBER ride to office')).toBe('transport');
    expect(guessCategory('Netflix for March')).toBe('entertainment');
    expect(guessCategory("Domino's order")).toBe('food');
  });

  it('matches plurals and singulars', () => {
    expect(guessCategory('Lunches this week')).toBe('food');
    expect(guessCategory('Movies')).toBe('entertainment');
    expect(guessCategory('grocery run')).toBe('food');
    expect(guessCategory('Snacks')).toBe('food');
    expect(guessCategory('ticket')).toBe('entertainment');
  });

  it('prefers phrases over single words', () => {
    expect(guessCategory('Train ticket to Pune')).toBe('travel');
    expect(guessCategory('Concert tickets')).toBe('entertainment');
    expect(guessCategory('Local train pass')).toBe('transport');
    expect(guessCategory('Electricity and water bill')).toBe('utilities');
  });

  it('matches whole words only', () => {
    expect(guessCategory('Barber')).toBeNull(); // not "bar"
    expect(guessCategory('Teacher gift')).toBe('life'); // "gift", not "tea"
    expect(guessCategory('Automobile')).toBeNull(); // not "auto"
  });

  it('returns null when nothing matches', () => {
    expect(guessCategory('Misc')).toBeNull();
    expect(guessCategory('')).toBeNull();
  });
});
