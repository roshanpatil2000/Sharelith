import { formatPlace } from '../geoip';

it('formats city, region and country without repeats', () => {
  expect(
    formatPlace({ city: 'Pune', region: 'Maharashtra', country: 'IN' }),
  ).toBe('Pune, Maharashtra, IN');
  expect(
    formatPlace({ city: 'Singapore', region: 'Singapore', country: 'SG' }),
  ).toBe('Singapore, SG');
  expect(formatPlace({})).toBeNull();
});
