// ============================================
// vibeOnly — Local Storage Service
// ============================================

import { Injectable } from '@angular/core';
import { Track, Playlist, ThemeMode } from '../models';

const KEYS = {
  FAVORITES: 'vo_favorites',
  RECENT: 'vo_recent',
  PLAYLISTS: 'vo_playlists',
  THEME: 'vo_theme',
  VOLUME: 'vo_volume',
  PLAYS: 'vo_plays',
  SESSION: 'vo_session',
  PLAYER_PREFS: 'vo_player_prefs',
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

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor() {
    this.cleanLegacyTracks();
  }

  // ── Data Migration / Cleanup ──
  private cleanLegacyTracks(): void {
    try {
      const isInvalidTrack = (t: Track) => {
        // Radio stations always have 0 duration, so we should allow them.
        if (t.category === 'Radio' || t.provider === 'radio' || t.isLive) return false;
        // Uploads may not have a duration stored; they're still playable
        if (t.provider === 'supabase') return false;
        return t.duration === 0 || t.audio.includes('format=VBR') || t.audio.includes('sample-1');
      };
      
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
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[StorageService] Failed to save:', key, e);
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
