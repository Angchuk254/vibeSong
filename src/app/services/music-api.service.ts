// ============================================
// vibeOnly — Music API Service
// ============================================

import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, from, of, timeout } from 'rxjs';
import { map, catchError, shareReplay, defaultIfEmpty } from 'rxjs/operators';
import { Track, MusicCategory, ArtistSummary, Collection } from '../models';
import { RadioProvider } from '../core/providers/radio.provider';
import { SupabaseProvider } from '../core/providers/supabase.provider';
import { ArchiveProvider } from '../core/providers/archive.provider';
import { AudiusProvider } from '../core/providers/audius.provider';
import { ItunesProvider } from '../core/providers/itunes.provider';
import { MUSIC_CATEGORIES } from '../core/categories.data';
import { DeviceMusicService } from './device-music.service';
import { StorageService } from './storage.service';

/**
 * Aggregates the music sources. Full-length songs (your Supabase uploads, Audius,
 * Internet Archive) always come first; 30s iTunes previews after; live radio is
 * kept separate so stations never get mixed into song lists.
 */
@Injectable({ providedIn: 'root' })
export class MusicApiService {
  private radio = inject(RadioProvider);
  private supabase = inject(SupabaseProvider);
  private archive = inject(ArchiveProvider);
  private audius = inject(AudiusProvider);
  private itunes = inject(ItunesProvider);
  private device = inject(DeviceMusicService);
  private storage = inject(StorageService);

  /** When on, 30-second previews are left out everywhere */
  readonly hidePreviews = signal(this.storage.getHidePreviews());

  setHidePreviews(hide: boolean): void {
    this.hidePreviews.set(hide);
    this.storage.setHidePreviews(hide);
    this.clearCache();
  }

  /** YouTube search for the full version of a song */
  static youtubeUrl(t: Track): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.artist_name} ${t.name}`)}`;
  }

  private trendingCache$: Observable<Track[]> | null = null;
  private readonly rowCache = new Map<string, Observable<unknown>>();

  getTrendingTracks(limit = 20): Observable<Track[]> {
    if (!this.trendingCache$) {
      // Uploads have their own row, so trending doesn't wait on Supabase
      this.trendingCache$ = this.safe(this.audius.getTrendingTracks(limit)).pipe(shareReplay(1));
    }
    return this.trendingCache$;
  }

  /** Your own uploads from Supabase */
  getMyUploads(limit = 30): Observable<Track[]> {
    return this.safe(this.supabase.getTrendingTracks(limit));
  }

  // ── Artists ──

  getTrendingArtists(limit = 12): Observable<ArtistSummary[]> {
    return this.cachedAny(`artists:${limit}`, () => this.audius.getTrendingArtists(limit).pipe(catchError(() => of([]))));
  }

  searchArtists(query: string, limit = 8): Observable<ArtistSummary[]> {
    return this.audius.searchArtists(query, limit).pipe(timeout(10000), catchError(() => of([])));
  }

  /** Artist page data for a ref like "audius:abc" or "itunes:123" */
  getArtistPage(ref: string): Observable<{ artist: ArtistSummary | null; tracks: Track[] }> {
    const [source, id] = this.splitRef(ref);
    if (source === 'itunes') return this.itunes.getArtist(id);
    if (source === 'audius') {
      return forkJoin([
        this.audius.getArtist(id).pipe(catchError(() => of(null))),
        this.safe(this.audius.getArtistTracks(id, 50)),
      ]).pipe(map(([artist, tracks]) => ({ artist, tracks })));
    }
    return of({ artist: null, tracks: [] });
  }

  // ── Public playlists & albums ──

  getTrendingPlaylists(limit = 16): Observable<Collection[]> {
    return this.cachedAny(`playlists:${limit}`, () => this.audius.getTrendingPlaylists(limit).pipe(catchError(() => of([]))));
  }

  searchPlaylists(query: string, limit = 8): Observable<Collection[]> {
    return this.audius.searchPlaylists(query, limit).pipe(timeout(10000), catchError(() => of([])));
  }

  getCollection(ref: string): Observable<Collection | null> {
    const [source, id] = this.splitRef(ref);
    if (source !== 'audius') return of(null);
    return forkJoin([
      this.audius.getCollection(id).pipe(catchError(() => of(null))),
      this.safe(this.audius.getCollectionTracks(id)),
    ]).pipe(map(([c, tracks]) => (c ? { ...c, tracks } : tracks.length ? { ref, name: 'Playlist', owner: '', image: tracks[0].image, tracks } : null)));
  }

  /** Ladakhi, Spiti/Kinnaur and Tibetan songs mixed together */
  getHimalayanMix(limit = 24): Observable<Track[]> {
    return this.cachedAny(`himalayan:${limit}`, () => {
      const pick = (id: string) => MUSIC_CATEGORIES.find((c) => c.id === id);
      const cats = ['ladakhi', 'spiti', 'tibet'].map(pick).filter((c): c is MusicCategory => !!c);
      return forkJoin(cats.map((c) => this.getCategoryTracks({ ...c, sources: { ...c.sources, radio: undefined } }, 15))).pipe(
        // Interleave so one region doesn't crowd out the others
        map((lists) => {
          const out: Track[] = [];
          for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
            lists.forEach((l) => l[i] && out.push(l[i]));
          }
          return this.rank(this.dedupe(out)).slice(0, limit);
        })
      );
    });
  }

  getGenreTracks(genre: string, limit = 15): Observable<Track[]> {
    return this.cached(`genre:${genre}:${limit}`, () => this.safe(this.audius.getTrendingByGenre(genre, limit)));
  }

  getUndergroundTracks(limit = 15): Observable<Track[]> {
    return this.cached(`underground:${limit}`, () => this.safe(this.audius.getFeaturedTracks(limit)));
  }

  getPreviewTracks(term: string, limit = 15, country = 'IN'): Observable<Track[]> {
    if (this.hidePreviews()) return of([]);
    return this.cached(`itunes:${term}:${limit}:${country}`, () => this.safe(this.itunes.search(term, limit, country)));
  }

  getArchiveTracks(limit = 10): Observable<Track[]> {
    return this.cached(`archive:${limit}`, () => this.safe(this.archive.getFeaturedTracks(limit)));
  }

  getRadioStations(region = 'india', limit = 15): Observable<Track[]> {
    return this.cached(`radio:${region}:${limit}`, () => this.safe(this.radio.getRegionalTracks(region, limit)));
  }

  searchStations(query: string, limit = 10): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.safe(this.radio.searchTracks(query, limit));
  }

  /** Builds a category page from its source recipe */
  getCategoryTracks(cat: MusicCategory, limit = 30): Observable<Track[]> {
    const s = cat.sources;
    if (!s) return this.getTracksByTag(cat.tag, limit);

    const matches = (t: Track) => {
      if (!s.match?.length) return true;
      const text = `${t.name} ${t.artist_name} ${t.tags || ''} ${t.genre || ''} ${t.album_name}`.toLowerCase();
      return s.match.some((k) => text.includes(k.toLowerCase()));
    };

    const sources: Observable<Track[]>[] = [
      from(this.device.ready).pipe(map(() => this.device.byCategory(cat.id))),
      this.supabase.getTracksByTag(s.uploads || cat.name, limit),
    ];
    if (s.audiusGenre) sources.push(this.audius.getTrendingByGenre(s.audiusGenre, limit));
    (s.audius || []).forEach((q) =>
      sources.push(this.audius.searchTracks(q, Math.ceil(limit / 2)).pipe(map((ts) => ts.filter(matches))))
    );
    if (s.archive) sources.push(this.archive.searchTracks(s.archive, 10));
    const terms = Array.isArray(s.itunes) ? s.itunes : s.itunes ? [s.itunes] : [];
    const perTerm = terms.length > 1 ? Math.ceil(limit / terms.length) + 5 : limit;
    terms.forEach((term) => sources.push(this.itunes.search(term, perTerm, s.itunesCountry || 'IN')));
    if (s.radio) sources.push(this.radio.getRegionalTracks(s.radio, limit));
    return this.merge(sources);
  }

  getTracksByTag(tag: string, limit = 20): Observable<Track[]> {
    return this.merge([
      this.supabase.getTracksByTag(tag, limit),
      this.audius.getTracksByTag(tag, limit),
      this.itunes.search(tag, limit),
    ]);
  }

  searchTracks(query: string, limit = 20): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.merge([
      from(this.device.ready).pipe(map(() => this.device.search(query))),
      this.supabase.searchTracks(query, limit),
      this.audius.searchTracks(query, limit),
      this.archive.searchTracks(query, 6),
      this.itunes.searchTracks(query, limit),
    ]);
  }

  getFeaturedTracks(limit = 10): Observable<Track[]> {
    return this.merge([this.supabase.getFeaturedTracks(limit), this.audius.getFeaturedTracks(limit)]);
  }

  getRelaxTracks(limit = 10): Observable<Track[]> {
    return this.getGenreTracks('Ambient', limit);
  }

  /**
   * "Made for you": looks at what you like and replay, then pulls more from
   * your top genres and artists. Falls back to trending for new listeners.
   */
  getRecommendations(seeds: Track[], exclude: Set<string> = new Set(), limit = 20): Observable<Track[]> {
    const genres = this.topValues(seeds.map((t) => t.genre).filter((g): g is string => !!g && AudiusProvider.GENRES.includes(g)), 2);
    const artists = this.topValues(
      seeds.filter((t) => !t.isLive).map((t) => t.artist_name).filter((a) => a && !/unknown|archive/i.test(a)),
      2
    );

    const sources: Observable<Track[]>[] = [
      ...genres.map((g) => this.audius.getTrendingByGenre(g, limit)),
      ...artists.map((a) => this.audius.searchTracks(a, 8)),
    ];
    if (sources.length === 0) sources.push(this.audius.getFeaturedTracks(limit));

    return this.merge(sources).pipe(
      map((tracks) => this.shuffle(tracks.filter((t) => !exclude.has(t.id) && !t.isLive)).slice(0, limit))
    );
  }

  /** More tracks like this one, used for autoplay when the queue runs out */
  getSimilarTracks(track: Track, limit = 15): Observable<Track[]> {
    if (track.isLive) return this.getRadioStations(track.tags?.split(',')[0] || 'india', limit);
    if (track.provider === 'device') {
      // Keep going through your own songs from the same category first
      const mine = this.shuffle(this.device.byCategory(track.category || '').filter((t) => t.id !== track.id));
      const cat = MUSIC_CATEGORIES.find((c) => c.id === track.category);
      return (cat ? this.getCategoryTracks(cat, limit) : this.audius.getTrendingTracks(limit)).pipe(
        map((more) => this.dedupe([...mine, ...more.filter((t) => t.id !== track.id)]))
      );
    }
    const genre = track.genre && AudiusProvider.GENRES.includes(track.genre) ? track.genre : null;
    const sources = genre
      ? [this.audius.getTrendingByGenre(genre, limit), this.audius.searchTracks(track.artist_name, 6)]
      : [this.audius.searchTracks(track.artist_name, 8), this.audius.getTrendingTracks(limit)];
    return this.merge(sources).pipe(map((tracks) => this.shuffle(tracks.filter((t) => t.id !== track.id))));
  }

  clearCache(): void {
    this.trendingCache$ = null;
    this.rowCache.clear();
  }

  // ── Helpers ──

  private merge(sources: Observable<Track[]>[]): Observable<Track[]> {
    if (sources.length === 0) return of([]);
    return forkJoin(sources.map((s) => this.safe(s))).pipe(
      map((results) => {
        const all = this.rank(this.dedupe(results.flat()));
        return this.hidePreviews() ? all.filter((t) => !t.isPreview) : all;
      }),
      defaultIfEmpty([] as Track[])
    );
  }

  private safe(source: Observable<Track[]>): Observable<Track[]> {
    return source.pipe(
      timeout(10000),
      catchError((err) => {
        console.warn('[MusicApiService] Source failed:', err);
        return of([] as Track[]);
      })
    );
  }

  private cached(key: string, factory: () => Observable<Track[]>): Observable<Track[]> {
    return this.cachedAny(key, factory);
  }

  private cachedAny<T>(key: string, factory: () => Observable<T>): Observable<T> {
    let obs = this.rowCache.get(key) as Observable<T> | undefined;
    if (!obs) {
      obs = factory().pipe(shareReplay(1));
      this.rowCache.set(key, obs as Observable<unknown>);
    }
    return obs;
  }

  private splitRef(ref: string): [string, string] {
    const i = ref.indexOf(':');
    return i > 0 ? [ref.slice(0, i), ref.slice(i + 1)] : ['', ref];
  }

  private dedupe(tracks: Track[]): Track[] {
    const seen = new Set<string>();
    return tracks.filter((t) => {
      if (!t?.audio) return false;
      const key = `${t.name}|${t.artist_name}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
      if (seen.has(t.id) || seen.has(key)) return false;
      seen.add(t.id);
      seen.add(key);
      return true;
    });
  }

  /** Full songs first, then previews, then live radio; order within each group is kept */
  private rank(tracks: Track[]): Track[] {
    const weight = (t: Track) => (t.isLive ? 2 : t.isPreview ? 1 : 0);
    return tracks.map((t, i) => ({ t, i })).sort((a, b) => weight(a.t) - weight(b.t) || a.i - b.i).map((x) => x.t);
  }

  private topValues(values: string[], n: number): string[] {
    const counts = new Map<string, number>();
    values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v);
  }

  private shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
