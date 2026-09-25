import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { YouTubeService } from './youtube.service';

describe('YouTubeService', () => {
  let yt: YouTubeService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    yt = TestBed.inject(YouTubeService);
  });

  it.each([
    ['https://www.youtube.com/watch?v=abcdefghijk', 'abcdefghijk'],
    ['https://youtu.be/abcdefghijk?si=share', 'abcdefghijk'],
    ['youtube.com/shorts/abcdefghijk', 'abcdefghijk'],
    ['https://music.youtube.com/watch?v=abcdefghijk&feature=share', 'abcdefghijk'],
    ['https://m.youtube.com/watch?v=abcdefghijk&t=30', 'abcdefghijk'],
    ['abcdefghijk', 'abcdefghijk'],
  ])('reads the video id from %s', (url, id) => {
    expect(yt.parseUrl(url).videoId).toBe(id);
  });

  it('reads playlist links', () => {
    expect(yt.parseUrl('https://www.youtube.com/playlist?list=PL123abc')).toEqual({ videoId: undefined, listId: 'PL123abc' });
    expect(yt.parseUrl('https://youtube.com/watch?v=abcdefghijk&list=PLx')).toEqual({ videoId: 'abcdefghijk', listId: 'PLx' });
  });

  it('rejects things that are not YouTube links', () => {
    expect(yt.parseUrl('hello world')).toEqual({ videoId: undefined, listId: undefined });
  });

  it('splits "Artist - Title (Official Video)"', () => {
    const split = (yt as any).splitTitle.bind(yt);
    expect(split('Stanzin - Julley Ladakh (Official Video)', 'Ladakh Music')).toEqual({ artist: 'Stanzin', title: 'Julley Ladakh' });
    expect(split('Julley Ladakh | New Song 2024', 'Stanzin - Topic')).toEqual({ artist: 'Stanzin', title: 'Julley Ladakh' });
  });

  it('parses ISO durations', () => {
    expect((yt as any).isoDuration('PT4M10S')).toBe(250);
    expect((yt as any).isoDuration('PT1H2M3S')).toBe(3723);
  });

  it('needs a key before searching', () => {
    let result: unknown;
    yt.search('ladakhi').subscribe((r) => (result = r));
    expect(result).toEqual([]);
    expect(yt.hasKey()).toBe(false);
  });

  it('maps a video to a playable track', () => {
    const t = yt.toTrack({ id: 'abcdefghijk', title: 'Song', artist: 'Singer', thumb: 'img' });
    expect(YouTubeService.idOf(t)).toBe('abcdefghijk');
    expect(t.provider).toBe('youtube');
  });
});
