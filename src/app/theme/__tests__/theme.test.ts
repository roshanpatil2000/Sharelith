import { buildTheme, darkColors, lightColors, resolveScheme } from '..';

describe('resolveScheme', () => {
  it('follows the system when preference is system', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', null)).toBe('light');
  });

  it('honours an explicit preference over the system', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });
});

describe('palettes', () => {
  it('light and dark define the same tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
    expect(Object.keys(darkColors.category).sort()).toEqual(
      Object.keys(lightColors.category).sort(),
    );
  });

  it('buildTheme picks the matching palette', () => {
    expect(buildTheme('dark').colors).toBe(darkColors);
    expect(buildTheme('light').colors).toBe(lightColors);
  });
});
