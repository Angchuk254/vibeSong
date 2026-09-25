import { MUSIC_CATEGORIES } from './categories.data';

describe('MUSIC_CATEGORIES', () => {
  it('has unique ids and tags', () => {
    const ids = MUSIC_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tags = MUSIC_CATEGORIES.map((c) => c.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('every radio category has a station source', () => {
    for (const c of MUSIC_CATEGORIES.filter((c) => c.group === 'radio')) {
      expect(c.sources?.radio, c.id).toBeTruthy();
    }
  });

  it('Himalayan regions pull from several sources', () => {
    for (const id of ['ladakhi', 'spiti', 'himachali', 'uttarakhand', 'pahadi']) {
      const s = MUSIC_CATEGORIES.find((c) => c.id === id)!.sources!;
      expect((s.audius || []).length, id).toBeGreaterThanOrEqual(3);
      expect((s.itunes as string[]).length, id).toBeGreaterThanOrEqual(5);
      expect(s.radio, id).toBeTruthy();
    }
  });
});
