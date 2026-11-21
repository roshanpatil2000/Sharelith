import {
  friendlyDate,
  fromISODate,
  longDate,
  toISODate,
  todayISO,
} from '../dates';

const now = new Date(2026, 10, 21, 0, 30); // 21 Nov 2026, 00:30 local

it('uses the local calendar day, not UTC', () => {
  expect(toISODate(now)).toBe('2026-11-21');
  expect(todayISO(now)).toBe('2026-11-21');
});

it('round-trips a day', () => {
  expect(toISODate(fromISODate('2026-03-05'))).toBe('2026-03-05');
});

it('names days people recognise', () => {
  expect(friendlyDate('2026-11-21', now)).toBe('Today');
  expect(friendlyDate('2026-11-20', now)).toBe('Yesterday');
  expect(friendlyDate('2026-11-02', now)).toBe('2 Nov 2026');
  expect(longDate('2026-11-02')).toBe('2 November 2026');
});
