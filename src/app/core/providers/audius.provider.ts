import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, switchMap, shareReplay, timeout } from 'rxjs/operators';
import { Track, ArtistSummary, Collection } from '../../models';
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
    'Soundtrack', 'House', 'Downtempo', 'Latin', 'Reggae', 'Blues', 'Metal', 'Punk',
    'Country', 'Funk', 'Techno', 'Trap', 'Deep House', 'Drum & Bass', 'Dubstep',
    'Trance', 'Future Bass', 'Experimental', 'Dancehall', 'Disco', 'Kids',
    'Podcasts', 'Spoken Word', 'Audiobooks', 'Comedy', 'Hyperpop', 'Vaporwave',
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

  // ── Artists ──

  searchArtists(query: string, limit = 10): Observable<ArtistSummary[]> {
    if (!query.trim()) return of([]);
    return this.raw('/users/search', { query, limit }).pipe(
      map((users) => users.filter((u) => u.track_count > 0).slice(0, limit).map((u) => this.mapArtist(u)))
    );
  }

  getArtist(id: string): Observable<ArtistSummary | null> {
    return this.rawOne(`/users/${encodeURIComponent(id)}`).pipe(map((u) => (u ? this.mapArtist(u) : null)));
  }

  getArtistTracks(id: string, limit = 50): Observable<Track[]> {
    return this.get(`/users/${encodeURIComponent(id)}/tracks`, { limit, sort: 'plays' }, limit);
  }

  /** Artists behind this week's trending songs */
  getTrendingArtists(limit = 12): Observable<ArtistSummary[]> {
    return this.raw('/tracks/trending', { limit: 60, time: 'week' }).pipe(
      map((tracks) => {
        const seen = new Set<string>();
        return tracks
          .map((t) => t.user)
          .filter((u) => u?.id && !seen.has(u.id) && seen.add(u.id))
          .slice(0, limit)
          .map((u) => this.mapArtist(u));
      })
    );
  }

  // ── Playlists & albums ──

  getTrendingPlaylists(limit = 20): Observable<Collection[]> {
    return this.raw('/playlists/trending', { limit, time: 'week' }).pipe(
      map((pls) => pls.filter((p) => p.track_count >= 3).slice(0, limit).map((p) => this.mapCollection(p)))
    );
  }

  searchPlaylists(query: string, limit = 10): Observable<Collection[]> {
    if (!query.trim()) return of([]);
    return this.raw('/playlists/search', { query, limit }).pipe(
      map((pls) => pls.filter((p) => p.track_count >= 2).slice(0, limit).map((p) => this.mapCollection(p)))
    );
  }

  getCollection(id: string): Observable<Collection | null> {
    return this.rawOne(`/playlists/${encodeURIComponent(id)}`).pipe(map((p) => (p ? this.mapCollection(p) : null)));
  }

  getCollectionTracks(id: string, limit = 200): Observable<Track[]> {
    return this.get(`/playlists/${encodeURIComponent(id)}/tracks`, { limit }, limit);
  }

  private get(path: string, params: Record<string, string | number>, limit: number): Observable<Track[]> {
    return this.raw(path, params).pipe(
      map((data) => data.filter((t) => this.isPlayable(t)).slice(0, limit).map((t) => this.mapToTrack(t)))
    );
  }

  private rawOne(path: string): Observable<any | null> {
    return this.request(path, {}).pipe(
      map((res: any) => (Array.isArray(res?.data) ? res.data[0] : res?.data) || null),
      catchError(() => of(null))
    );
  }

  /** Returns the response's data array, or [] if every host failed */
  private raw(path: string, params: Record<string, string | number>): Observable<any[]> {
    return this.request(path, params).pipe(
      map((res: any) => (Array.isArray(res?.data) ? res.data : [])),
      catchError((err) => {
        console.error('[AudiusProvider] Error:', err);
        return of([]);
      })
    );
  }

  private request(path: string, params: Record<string, string | number>): Observable<unknown> {
    const qs = new URLSearchParams({ app_name: this.appName });
    Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)));

    const request = (host: string) =>
      this.http.get(`${host}/v1${path}?${qs.toString()}`).pipe(timeout(10000));

    return request(this.gateway).pipe(
      catchError(() => this.discoverHost().pipe(switchMap((host) => request(host))))
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
      artistRef: t.user?.id ? `audius:${t.user.id}` : undefined,
    };
  }

  private mapArtist(u: any): ArtistSummary {
    return {
      ref: `audius:${u.id}`,
      name: u.name || u.handle,
      image: u.profile_picture?.['480x480'] || u.profile_picture?.['150x150'] || '',
      cover: u.cover_photo?.['2000x'] || u.cover_photo?.['640x'] || '',
      bio: u.bio || '',
      followers: u.follower_count,
      trackCount: u.track_count,
      verified: !!u.is_verified,
    };
  }

  private mapCollection(p: any): Collection {
    return {
      ref: `audius:${p.id}`,
      name: p.playlist_name || 'Untitled',
      owner: p.user?.name || '',
      image: p.artwork?.['480x480'] || p.artwork?.['1000x1000'] || p.artwork?.['150x150'] || '',
      description: p.description || '',
      isAlbum: !!p.is_album,
      trackCount: p.track_count,
    };
  }
}
