// ============================================
// vibeOnly — Local Storage Service
// ============================================

import { Injectable } from '@angular/core';
import { Track, Playlist, ThemeMode, ArtistSummary } from '../models';

const KEYS = {
  FAVORITES: 'vo_favorites',
  RECENT: 'vo_recent',
  PLAYLISTS: 'vo_playlists',
  THEME: 'vo_theme',
  VOLUME: 'vo_volume',
  PLAYS: 'vo_plays',
  SESSION: 'vo_session',
  PLAYER_PREFS: 'vo_player_prefs',
  ARTISTS: 'vo_followed_artists',
  SEARCHES: 'vo_recent_searches',
  HIDE_PREVIEWS: 'vo_hide_previews',
  AUTO_FULL: 'vo_auto_full',
} as const;

export interface PlayerSession {
  queue: Track[];
  index: number;
  time: number;
}

export interface PlayerPrefs {
  shuffle: boolean;
  repeat: 'none' | 'one' | 'all';
  autoplay: boolean;
}

interface PlayStat {
  track: Track;
  count: number;
  last: number;
}

const MAX_PLAY_STATS = 300;

const MAX_RECENT = 50;

/** Show a short message in the player's toast (see PlayerService) */
export function notify(message: string): void {
  try {
    window.dispatchEvent(new CustomEvent('vo-notice', { detail: message }));
  } catch {
    /* no window (tests) */
  }
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor() {
    this.cleanLegacyTracks();
    // Ask the browser not to clear our data when the device is low on space
    try {
      navigator.storage?.persist?.().catch(() => undefined);
    } catch {
      /* not supported */
    }
  }

  // ── Data Migration / Cleanup ──
  private cleanLegacyTracks(): void {
    try {
      // Only drop tracks from sources that no longer exist. Never judge by
      // duration: radio, YouTube links and some local files legitimately have 0.
      const isInvalidTrack = (t: Track) =>
        !t?.id ||
        !t.audio ||
        t.provider === 'local' || // old SoundHelix placeholder songs
        t.provider === 'jamendo' ||
        t.audio.includes('format=VBR') ||
        t.audio.includes('sample-1');
      
      const favorites = this.getFavorites();
      const validFavs = favorites.filter((t) => !isInvalidTrack(t));
      if (validFavs.length !== favorites.length) this.setItem(KEYS.FAVORITES, validFavs);

      const recent = this.getRecentTracks();
      const validRecent = recent.filter((t) => !isInvalidTrack(t));
      if (validRecent.length !== recent.length) this.setItem(KEYS.RECENT, validRecent);
    } catch (e) {
      console.warn('[StorageService] Error during legacy track cleanup:', e);
    }
  }

  // ── Favorites ──

  getFavorites(): Track[] {
    return this.getItem<Track[]>(KEYS.FAVORITES) || [];
  }

  toggleFavorite(track: Track): boolean {
    const favorites = this.getFavorites();
    const idx = favorites.findIndex((t) => t.id === track.id);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      this.setItem(KEYS.FAVORITES, favorites);
      return false;
    } else {
      favorites.unshift(track);
      this.setItem(KEYS.FAVORITES, favorites);
      return true;
    }
  }

  isFavorite(trackId: string): boolean {
    return this.getFavorites().some((t) => t.id === trackId);
  }

  // ── Recent Plays ──

  getRecentTracks(): Track[] {
    return this.getItem<Track[]>(KEYS.RECENT) || [];
  }

  addRecentTrack(track: Track): void {
    let recent = this.getRecentTracks();
    recent = recent.filter((t) => t.id !== track.id);
    recent.unshift(track);
    if (recent.length > MAX_RECENT) {
      recent = recent.slice(0, MAX_RECENT);
    }
    this.setItem(KEYS.RECENT, recent);
  }

  clearRecent(): void {
    this.removeItem(KEYS.RECENT);
  }

  // ── Play stats (powers "On Repeat" and "Your top artists") ──

  recordPlay(track: Track): void {
    const stats = this.getItem<Record<string, PlayStat>>(KEYS.PLAYS) || {};
    const prev = stats[track.id];
    stats[track.id] = { track, count: (prev?.count || 0) + 1, last: Date.now() };

    const entries = Object.entries(stats);
    if (entries.length > MAX_PLAY_STATS) {
      entries.sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last);
      this.setItem(KEYS.PLAYS, Object.fromEntries(entries.slice(0, MAX_PLAY_STATS)));
    } else {
      this.setItem(KEYS.PLAYS, stats);
    }
  }

  /** Songs you play most, most-played first */
  getMostPlayed(limit = 20): Track[] {
    const stats = Object.values(this.getItem<Record<string, PlayStat>>(KEYS.PLAYS) || {});
    return stats
      .filter((s) => s.count >= 2)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, limit)
      .map((s) => s.track);
  }

  getTopArtists(limit = 6): { name: string; image: string; plays: number }[] {
    const stats = Object.values(this.getItem<Record<string, PlayStat>>(KEYS.PLAYS) || {});
    const artists = new Map<string, { name: string; image: string; plays: number }>();
    stats
      .filter((s) => !s.track.isLive && s.track.provider !== 'radio')
      .forEach((s) => {
        const a = artists.get(s.track.artist_name) || { name: s.track.artist_name, image: s.track.image || s.track.album_image, plays: 0 };
        a.plays += s.count;
        artists.set(a.name, a);
      });
    return [...artists.values()].sort((a, b) => b.plays - a.plays).slice(0, limit);
  }

  getTotalPlays(): number {
    return Object.values(this.getItem<Record<string, PlayStat>>(KEYS.PLAYS) || {}).reduce((n, s) => n + s.count, 0);
  }

  clearPlayStats(): void {
    this.removeItem(KEYS.PLAYS);
  }

  // ── Followed artists ──

  getFollowedArtists(): ArtistSummary[] {
    return this.getItem<ArtistSummary[]>(KEYS.ARTISTS) || [];
  }

  toggleFollowArtist(artist: ArtistSummary): boolean {
    const list = this.getFollowedArtists();
    const idx = list.findIndex((a) => a.ref === artist.ref);
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift({ ref: artist.ref, name: artist.name, image: artist.image, verified: artist.verified });
    this.setItem(KEYS.ARTISTS, list);
    return idx < 0;
  }

  // ── Preferences ──

  getHidePreviews(): boolean {
    return this.getItem<boolean>(KEYS.HIDE_PREVIEWS) === true;
  }

  setHidePreviews(hide: boolean): void {
    this.setItem(KEYS.HIDE_PREVIEWS, hide);
  }

  /** Play previews in full from YouTube (default on) */
  getAutoFull(): boolean {
    return this.getItem<boolean>(KEYS.AUTO_FULL) !== false;
  }

  setAutoFull(on: boolean): void {
    this.setItem(KEYS.AUTO_FULL, on);
  }

  // ── Recent searches ──

  getRecentSearches(): string[] {
    return this.getItem<string[]>(KEYS.SEARCHES) || [];
  }

  addRecentSearch(q: string): void {
    const query = q.trim();
    if (query.length < 2) return;
    const list = [query, ...this.getRecentSearches().filter((s) => s.toLowerCase() !== query.toLowerCase())].slice(0, 12);
    this.setItem(KEYS.SEARCHES, list);
  }

  clearRecentSearches(): void {
    this.removeItem(KEYS.SEARCHES);
  }

  // ── Backup ──

  /** Everything personal, for export/import */
  exportLibrary(): string {
    return JSON.stringify({
      app: 'vibeOnly',
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites: this.getFavorites(),
      playlists: this.getPlaylists(),
      artists: this.getFollowedArtists(),
    }, null, 2);
  }

  /** Merges a backup into the current library; returns what was added */
  importLibrary(json: string): { songs: number; playlists: number; artists: number } {
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') throw new Error('Not a vibeOnly backup');
    const result = { songs: 0, playlists: 0, artists: 0 };

    const favs = this.getFavorites();
    const favIds = new Set(favs.map((t) => t.id));
    for (const t of (data.favorites || []) as Track[]) {
      if (t?.id && t.audio && !favIds.has(t.id)) { favs.push(t); favIds.add(t.id); result.songs++; }
    }
    this.setItem(KEYS.FAVORITES, favs);

    const playlists = this.getPlaylists();
    for (const p of (data.playlists || []) as Playlist[]) {
      if (!p?.id || !Array.isArray(p.tracks)) continue;
      const existing = playlists.find((x) => x.id === p.id);
      if (existing) {
        const ids = new Set(existing.tracks.map((t) => t.id));
        existing.tracks.push(...p.tracks.filter((t) => t?.id && !ids.has(t.id)));
      } else {
        playlists.push(p);
        result.playlists++;
      }
    }
    this.setItem(KEYS.PLAYLISTS, playlists);

    const artists = this.getFollowedArtists();
    const refs = new Set(artists.map((a) => a.ref));
    for (const a of (data.artists || []) as ArtistSummary[]) {
      if (a?.ref && !refs.has(a.ref)) { artists.push(a); refs.add(a.ref); result.artists++; }
    }
    this.setItem(KEYS.ARTISTS, artists);
    return result;
  }

  // ── Player session ──

  savePlayerSession(session: PlayerSession): void {
    this.setItem(KEYS.SESSION, session);
  }

  getPlayerSession(): PlayerSession | null {
    return this.getItem<PlayerSession>(KEYS.SESSION);
  }

  savePlayerPrefs(prefs: PlayerPrefs): void {
    this.setItem(KEYS.PLAYER_PREFS, prefs);
  }

  getPlayerPrefs(): PlayerPrefs | null {
    return this.getItem<PlayerPrefs>(KEYS.PLAYER_PREFS);
  }

  // ── Playlists ──

  getPlaylists(): Playlist[] {
    return this.getItem<Playlist[]>(KEYS.PLAYLISTS) || [];
  }

  savePlaylist(playlist: Playlist): void {
    const playlists = this.getPlaylists();
    const idx = playlists.findIndex((p) => p.id === playlist.id);
    if (idx >= 0) {
      playlists[idx] = { ...playlist, updatedAt: new Date().toISOString() };
    } else {
      playlists.push({
        ...playlist,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.setItem(KEYS.PLAYLISTS, playlists);
  }

  deletePlaylist(playlistId: string): void {
    const playlists = this.getPlaylists().filter((p) => p.id !== playlistId);
    this.setItem(KEYS.PLAYLISTS, playlists);
  }

  getPlaylist(playlistId: string): Playlist | undefined {
    return this.getPlaylists().find((p) => p.id === playlistId);
  }

  addTrackToPlaylist(playlistId: string, track: Track): void {
    const playlist = this.getPlaylist(playlistId);
    if (playlist) {
      if (!playlist.tracks.find((t) => t.id === track.id)) {
        playlist.tracks.push(track);
        this.savePlaylist(playlist);
      }
    }
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string): void {
    const playlist = this.getPlaylist(playlistId);
    if (playlist) {
      playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId);
      this.savePlaylist(playlist);
    }
  }

  // ── Theme ──

  getTheme(): ThemeMode {
    return (this.getItem<string>(KEYS.THEME) as ThemeMode) || 'dark';
  }

  saveTheme(theme: ThemeMode): void {
    this.setItem(KEYS.THEME, theme);
  }

  // ── Volume ──

  getVolume(): number | null {
    const vol = this.getItem<number>(KEYS.VOLUME);
    return vol !== null ? vol : null;
  }

  saveVolume(volume: number): void {
    this.setItem(KEYS.VOLUME, volume);
  }

  // ── Generic helpers ──

  private getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: unknown): void {
    const json = JSON.stringify(value);
    try {
      localStorage.setItem(key, json);
    } catch (e) {
      // Storage full: drop things that can be rebuilt, then try once more
      console.warn('[StorageService] Save failed, freeing space:', key, e);
      this.freeSpace(key);
      try {
        localStorage.setItem(key, json);
      } catch (e2) {
        console.error('[StorageService] Could not save', key, e2);
        notify("Couldn't save — your browser storage is full. Export a backup from Library.");
      }
    }
  }

  /** Remove caches and history (never likes, playlists or artists) */
  private freeSpace(except: string): void {
    const rebuildable = ['vo_youtube_cache', KEYS.SESSION, KEYS.PLAYS, KEYS.SEARCHES, 'vo_youtube_full'];
    for (const k of rebuildable) {
      if (k !== except) {
        try { localStorage.removeItem(k); } catch { /* ignore */ }
      }
    }
    if (except !== KEYS.RECENT) {
      const recent = this.getRecentTracks();
      if (recent.length > 20) {
        try { localStorage.setItem(KEYS.RECENT, JSON.stringify(recent.slice(0, 20))); } catch { /* ignore */ }
      }
    }
  }

  private removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}
