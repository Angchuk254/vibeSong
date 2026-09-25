// ============================================
// vibeOnly — Songs on this device (IndexedDB)
// ============================================
// Lets you add your own audio files (e.g. Ladakhi or Spiti songs that no free
// catalog carries). Files stay in this browser; nothing is uploaded anywhere.

import { Injectable, computed, signal } from '@angular/core';
import { Track } from '../models';
import { YT_PREFIX, YouTubeVideo } from './youtube.service';

interface StoredSong {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  category: string;
  cover: string; // small JPEG data URL, or ''
  addedAt: number;
  /** Audio file (for songs added from this device) */
  blob?: Blob;
  /** YouTube video id (for songs added from a YouTube link) */
  youtubeId?: string;
}

const DB_NAME = 'vibeonly-device';
const STORE = 'songs';
export const DEVICE_PREFIX = 'device:';

@Injectable({ providedIn: 'root' })
export class DeviceMusicService {
  /** Metadata for every song on this device (newest first) */
  readonly tracks = signal<Track[]>([]);
  readonly count = computed(() => this.tracks().length);
  readonly importing = signal<{ done: number; total: number } | null>(null);

  private db: Promise<IDBDatabase> | null = null;
  private urls = new Map<string, string>();
  /** Resolves once the songs saved in IndexedDB have been read */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.refresh();
  }

  static isDeviceTrack(t: Track | null | undefined): boolean {
    return !!t?.audio?.startsWith(DEVICE_PREFIX);
  }

  byCategory(category: string): Track[] {
    const c = category.toLowerCase();
    return this.tracks().filter((t) => (t.category || '').toLowerCase() === c);
  }

  search(query: string): Track[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.tracks().filter((t) =>
      `${t.name} ${t.artist_name} ${t.album_name} ${t.category}`.toLowerCase().includes(q)
    );
  }

  /** Adds audio files; returns how many were added */
  async addFiles(files: File[], category: string): Promise<number> {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(f.name));
    if (!audio.length) return 0;
    this.importing.set({ done: 0, total: audio.length });
    // Ask the browser not to evict these files when space runs low
    navigator.storage?.persist?.().catch(() => undefined);

    let added = 0;
    for (const file of audio) {
      try {
        const song = await this.readFile(file, category);
        await this.tx('readwrite', (s) => s.put(song));
        added++;
      } catch (e) {
        console.warn('[DeviceMusic] Could not add', file.name, e);
      }
      this.importing.update((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    this.importing.set(null);
    await this.refresh();
    return added;
  }

  /** Saves YouTube songs (from pasted links); returns how many were new */
  async addYouTube(videos: YouTubeVideo[], category: string): Promise<number> {
    const existing = new Set(this.tracks().map((t) => t.audio));
    let added = 0;
    let t = Date.now();
    for (const v of videos) {
      if (existing.has(`${YT_PREFIX}${v.id}`)) continue;
      const song: StoredSong = {
        id: `yt${v.id}`,
        name: v.title,
        artist: v.artist,
        album: 'YouTube',
        duration: v.duration || 0,
        category,
        cover: v.thumb,
        // Keep playlist order when listing newest-first
        addedAt: t--,
        youtubeId: v.id,
      };
      await this.tx('readwrite', (s) => s.put(song));
      added++;
    }
    await this.refresh();
    return added;
  }

  async remove(id: string): Promise<void> {
    await this.tx('readwrite', (s) => s.delete(id));
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    await this.refresh();
  }

  async setCategory(id: string, category: string): Promise<void> {
    const song = await this.get(id);
    if (!song) return;
    await this.tx('readwrite', (s) => s.put({ ...song, category }));
    await this.refresh();
  }

  /** Turns "device:<id>" into a playable blob: URL */
  async resolve(audio: string): Promise<string | null> {
    const id = audio.slice(DEVICE_PREFIX.length);
    const cached = this.urls.get(id);
    if (cached) return cached;
    const song = await this.get(id);
    if (!song?.blob) return null;
    const url = URL.createObjectURL(song.blob);
    this.urls.set(id, url);
    return url;
  }

  // ── Internals ──

  private async refresh(): Promise<void> {
    try {
      const all = await this.tx<StoredSong[]>('readonly', (s) => s.getAll());
      this.tracks.set(all.sort((a, b) => b.addedAt - a.addedAt).map((s) => this.toTrack(s)));
    } catch (e) {
      console.warn('[DeviceMusic] Storage unavailable', e);
    }
  }

  private get(id: string): Promise<StoredSong | undefined> {
    return this.tx<StoredSong | undefined>('readonly', (s) => s.get(id));
  }

  private toTrack(s: StoredSong): Track {
    return {
      id: `device-${s.id}`,
      name: s.name,
      artist_name: s.artist,
      artist_id: '',
      album_name: s.album,
      album_id: '',
      album_image: s.cover,
      duration: s.duration,
      audio: s.youtubeId ? `${YT_PREFIX}${s.youtubeId}` : `${DEVICE_PREFIX}${s.id}`,
      audiodownload: '',
      image: s.cover,
      releasedate: new Date(s.addedAt).toISOString(),
      position: 1,
      category: s.category,
      provider: s.youtubeId ? 'youtube' : 'device',
      externalUrl: s.youtubeId ? `https://www.youtube.com/watch?v=${s.youtubeId}` : undefined,
    };
  }

  private async readFile(file: File, category: string): Promise<StoredSong> {
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
    // "Artist - Title" is the most common file naming
    const dash = base.split(/\s+-\s+/);
    let name = dash.length > 1 ? dash.slice(1).join(' - ') : base;
    let artist = dash.length > 1 ? dash[0] : 'Unknown Artist';
    let album = '';
    let duration = 0;
    let cover = '';

    try {
      const { parseBlob } = await import('music-metadata');
      const meta = await parseBlob(file, { duration: true });
      name = meta.common.title || name;
      artist = meta.common.artist || meta.common.albumartist || artist;
      album = meta.common.album || '';
      duration = meta.format.duration || 0;
      const pic = meta.common.picture?.[0];
      if (pic) cover = await this.shrinkCover(new Blob([new Uint8Array(pic.data)], { type: pic.format }));
    } catch {
      /* no tags — keep the filename guesses */
    }
    if (!duration) duration = await this.probeDuration(file);

    return {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      artist,
      album,
      duration,
      category,
      cover,
      addedAt: Date.now(),
      blob: file,
    };
  }

  private probeDuration(file: Blob): Promise<number> {
    return new Promise((resolve) => {
      const a = new Audio();
      const url = URL.createObjectURL(file);
      const done = (d: number) => {
        URL.revokeObjectURL(url);
        resolve(isFinite(d) ? d : 0);
      };
      a.preload = 'metadata';
      a.onloadedmetadata = () => done(a.duration);
      a.onerror = () => done(0);
      setTimeout(() => done(0), 5000);
      a.src = url;
    });
  }

  /** Embedded covers can be several MB; keep a 300px JPEG */
  private async shrinkCover(blob: Blob): Promise<string> {
    const bmp = await createImageBitmap(blob);
    const size = 300;
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.db;
  }

  private async tx<T = unknown>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }
}
