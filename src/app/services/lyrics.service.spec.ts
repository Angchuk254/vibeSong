import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LyricsService } from './lyrics.service';

describe('LyricsService', () => {
  let parse: (res: unknown) => ReturnType<LyricsService['getLyrics']> extends unknown ? any : never;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const svc = TestBed.inject(LyricsService);
    parse = (svc as any).parse.bind(svc);
  });

  it('parses synced lyrics in time order', () => {
    const l = parse({ syncedLyrics: '[00:05.00] Second\n[00:01.50] First\n[01:00.00] Third' });
    expect(l.synced).toBe(true);
    expect(l.lines.map((x: any) => [x.time, x.text])).toEqual([[1.5, 'First'], [5, 'Second'], [60, 'Third']]);
  });

  it('falls back to plain lyrics', () => {
    const l = parse({ plainLyrics: 'a\nb' });
    expect(l.synced).toBe(false);
    expect(l.lines.length).toBe(2);
  });

  it('marks instrumentals and handles nothing found', () => {
    expect(parse({ instrumental: true }).instrumental).toBe(true);
    expect(parse(null)).toBeNull();
  });
});
