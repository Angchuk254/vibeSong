import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, shareReplay, timeout } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';

/**
 * Audius — free, open music catalog with full-length, CORS-friendly streams.
 * No API key needed; requests just carry an app_name.
 */
@Injectable({ providedIn: 'root' })
export class AudiusProvider implements MusicProvider {
  id = 'audius';
  name = 'Audius';

  private readonly http = inject(HttpClient);
  private readonly appName = 'VibeSong';
  private readonly gateway = 'https://api.audius.co';

  /** Discovery node to use. Falls back to a node picked from the gateway's host list. */
  private host$: Observable<string> | null = null;

  /** Genres Audius recognises for trending lists */
  static readonly GENRES = [
    'Electronic', 'Hip-Hop/Rap', 'Pop', 'Lo-Fi', 'Ambient', 'Acoustic', 'Folk',
    'World', 'Jazz', 'Classical', 'R&B/Soul', 'Rock', 'Alternative', 'Devotional',
    'Soundtrack', 'House', 'Downtempo', 'Latin', 'Reggae', 'Blues',
  ];

  getTrendingTracks(limit = 20, offset = 0): Observable<Track[]> {
    return this.get('/tracks/trending', { limit, offset, time: 'week' }, limit);
  }

  getTrendingByGenre(genre: string, limit = 20, time: 'week' | 'month' | 'allTime' = 'month'): Observable<Track[]> {
    return this.get('/tracks/trending', { genre, limit, time }, limit);
  }

  getTracksByTag(tag: string, limit = 20): Observable<Track[]> {
    const genre = AudiusProvider.GENRES.find((g) => g.toLowerCase() === tag.toLowerCase());
    return genre ? this.getTrendingByGenre(genre, limit) : this.searchTracks(tag, limit);
  }

  searchTracks(query: string, limit = 20): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.get('/tracks/search', { query, limit }, limit);
  }

  getFeaturedTracks(limit = 20): Observable<Track[]> {
    return this.get('/tracks/trending/underground', { limit }, limit);
  }

  private get(path: string, params: Record<string, string | number>, limit: number): Observable<Track[]> {
    const qs = new URLSearchParams({ app_name: this.appName });
    Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));

    const request = (host: string) =>
      this.http.get<{ data: any[] }>(`${host}/v1${path}?${qs.toString()}`).pipe(timeout(10000));

    return request(this.gateway).pipe(
      catchError(() => this.discoverHost().pipe(switchMap((host) => request(host)))),
      map((res) =>
        (res?.data || [])
          .filter((t) => this.isPlayable(t))
          .slice(0, limit)
          .map((t) => this.mapToTrack(t))
      ),
      catchError((err) => {
        console.error('[AudiusProvider] Error:', err);
        return of([]);
      })
    );
  }

  private discoverHost(): Observable<string> {
    if (!this.host$) {
      this.host$ = this.http.get<{ data: string[] }>(this.gateway).pipe(
        timeout(6000),
        switchMap((res) => {
          // Only *.audius.co nodes are allowed by the CSP in index.html
          const hosts = (res?.data || []).filter((h) => /^https:\/\/[a-z0-9.-]+\.audius\.co\/?$/i.test(h));
          if (!hosts.length) return throwError(() => new Error('No Audius hosts'));
          return of(hosts[Math.floor(Math.random() * hosts.length)]);
        }),
        shareReplay(1)
      );
    }
    return this.host$;
  }

  private isPlayable(t: any): boolean {
    return (
      !!t?.id &&
      t.is_streamable !== false &&
      !t.is_delete &&
      !t.stream_conditions &&
      (t.duration || 0) >= 45
    );
  }

  private mapToTrack(t: any): Track {
    const art = t.artwork?.['480x480'] || t.artwork?.['1000x1000'] || t.artwork?.['150x150'] || '';
    const stream = `${this.gateway}/v1/tracks/${t.id}/stream?app_name=${this.appName}`;
    return {
      id: `audius-${t.id}`,
      name: t.title || 'Untitled',
      artist_name: t.user?.name || 'Unknown Artist',
      artist_id: `audius-${t.user?.id || ''}`,
      album_name: t.genre || 'Audius',
      album_id: 'audius',
      album_image: art,
      duration: t.duration || 0,
      audio: stream,
      audiodownload: stream,
      image: art,
      releasedate: t.release_date || '',
      position: 1,
      tags: t.tags || '',
      genre: t.genre,
      mood: t.mood,
      playCount: t.play_count,
      provider: this.id,
    };
  }
}
