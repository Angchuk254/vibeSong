// ============================================
// vibeOnly — Lyrics Service (LRCLIB, free & keyless)
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
import { Track } from '../models';

export interface LyricLine {
  time: number; // seconds; -1 for unsynced lines
  text: string;
}

export interface Lyrics {
  synced: boolean;
  instrumental: boolean;
  lines: LyricLine[];
}

@Injectable({ providedIn: 'root' })
export class LyricsService {
  private http = inject(HttpClient);
  private readonly base = 'https://lrclib.net/api';
  private cache = new Map<string, Lyrics | null>();

  getLyrics(track: Track): Observable<Lyrics | null> {
    if (track.isLive || track.provider === 'radio') return of(null);
    const title = this.cleanTitle(track.name);
    const artist = this.cleanArtist(track.artist_name);
    const key = `${artist}|${title}`.toLowerCase();
    if (this.cache.has(key)) return of(this.cache.get(key)!);

    const exact = new URLSearchParams({ track_name: title, artist_name: artist });
    if (track.duration && !track.isPreview) exact.set('duration', String(Math.round(track.duration)));

    return this.http.get<any>(`${this.base}/get?${exact.toString()}`).pipe(
      timeout(8000),
      catchError(() =>
        // Fall back to a fuzzy search, preferring synced results
        this.http.get<any[]>(`${this.base}/search?${new URLSearchParams({ q: `${artist} ${title}` }).toString()}`).pipe(
          timeout(8000),
          map((results) => (results || []).find((r) => r.syncedLyrics) || (results || [])[0] || null),
          catchError(() => of(null))
        )
      ),
      switchMap((res) => of(this.parse(res))),
      map((lyrics) => {
        this.cache.set(key, lyrics);
        return lyrics;
      })
    );
  }

  private parse(res: any): Lyrics | null {
    if (!res) return null;
    if (res.instrumental) return { synced: false, instrumental: true, lines: [] };
    if (res.syncedLyrics) {
      const lines: LyricLine[] = [];
      for (const raw of String(res.syncedLyrics).split('\n')) {
        const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
        const text = raw.replace(/\[[^\]]*\]/g, '').trim();
        stamps.forEach((m) => lines.push({ time: +m[1] * 60 + +m[2], text }));
      }
      lines.sort((a, b) => a.time - b.time);
      if (lines.length) return { synced: true, instrumental: false, lines };
    }
    if (res.plainLyrics) {
      return {
        synced: false,
        instrumental: false,
        lines: String(res.plainLyrics).split('\n').map((text) => ({ time: -1, text })),
      };
    }
    return null;
  }

  /** "Song (Official Video) [Remix]" → "Song" so lookups match */
  private cleanTitle(name: string): string {
    return name
      .replace(/\s*[([](official|lyric|audio|video|visualizer|hd|4k|prod\.?)[^)\]]*[)\]]/gi, '')
      .replace(/\s*-\s*(official|lyrics?).*$/i, '')
      .trim();
  }

  private cleanArtist(name: string): string {
    return name.split(/,|&| feat\.? | ft\.? | x /i)[0].trim();
  }
}
