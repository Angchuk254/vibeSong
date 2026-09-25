import { DAILY_VIBES, LOCAL_FLAVOURS, pickForDay } from './vibes.data';

describe('daily vibes', () => {
  it('has several messages for every day of the week', () => {
    expect(DAILY_VIBES.length).toBe(7);
    DAILY_VIBES.forEach((day) => expect(day.length).toBeGreaterThanOrEqual(5));
  });

  it('keeps the same message all day and changes on other days', () => {
    const pool = DAILY_VIBES[1];
    const morning = new Date(2026, 8, 28, 7);
    const night = new Date(2026, 8, 28, 23);
    expect(pickForDay(pool, morning)).toBe(pickForDay(pool, night));
    const week = [...Array(14)].map((_, i) => pickForDay(pool, new Date(2026, 8, 28 + i)));
    expect(new Set(week).size).toBeGreaterThan(2);
  });

  it('gives a different message when shuffled', () => {
    const d = new Date(2026, 8, 28);
    const picks = new Set([0, 1, 2, 3, 4, 5].map((salt) => pickForDay(DAILY_VIBES[1], d, salt)));
    expect(picks.size).toBeGreaterThan(1);
  });

  it.each([
    ['Leh Ladakh India', 'Julley'],
    ['Kargil Ladakh India', 'Julley'],
    ['Kaza Himachal Pradesh India', 'Julley'],
    ['Kathmandu Bagmati Nepal', 'Namaste'],
    ['Thimphu Thimphu Bhutan', 'Kuzuzangpo la'],
    ['Dharamshala Himachal Pradesh India', 'Tashi Delek'],
    ['Manali Himachal Pradesh India', 'Ram Ram'],
  ])('greets %s with %s', (place, hello) => {
    expect(LOCAL_FLAVOURS.find((f) => f.match.test(place))?.hello).toBe(hello);
  });

  it('has no local greeting for other cities', () => {
    expect(LOCAL_FLAVOURS.find((f) => f.match.test('Mumbai Maharashtra India'))).toBeUndefined();
  });
});
