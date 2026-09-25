// ============================================
// vibeOnly — YouTube (official embed + optional Data API search)
// ============================================
// Full songs are played through YouTube's official IFrame player, which any
// site may embed. Without a key you can paste song/playlist links; with a
// free YouTube Data API key the app can also search YouTube itself.

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, of } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
import { Track } from '../models';

export const YT_PREFIX = 'youtube:';
const KEY_STORAGE = 'vo_youtube_key';
const CACHE_STORAGE = 'vo_youtube_cache';
const FULL_STORAGE = 'vo_youtube_full';
const CACHE_TTL = 7 * 24 * 3600 * 1000;

export interface YouTubeVideo {
  id: string;
  title: string;
  artist: string;
  thumb: string;
  duration?: number;
}

// Minimal typing for the IFrame API we use
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

@Injectable({ providedIn: 'root' })
export class YouTubeService {
  private http = inject(HttpClient);
  private apiPromise: Promise<any> | null = null;

  /** Optional YouTube Data API key (stored only in this browser) */
  readonly apiKey = signal(this.read<string>(KEY_STORAGE) || '');

  setApiKey(key: string): void {
    this.apiKey.set(key.trim());
    this.write(KEY_STORAGE, key.trim());
  }

  hasKey(): boolean {
    return this.apiKey().length > 20;
  }

  static idOf(track: Track | null | undefined): string | null {
    return track?.audio?.startsWith(YT_PREFIX) ? track.audio.slice(YT_PREFIX.length) : null;
  }

  // ── IFrame API ──

  loadApi(): Promise<any> {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!this.apiPromise) {
      this.apiPromise = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve(window.YT);
        };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => {
          this.apiPromise = null;
          reject(new Error('Could not load YouTube'));
        };
        document.head.appendChild(s);
      });
    }
    return this.apiPromise;
  }

  // ── Links ──

  /** Accepts watch/share/shorts/music links, playlist links, or a bare 11-char id */
  parseUrl(input: string): { videoId?: string; listId?: string } {
    const text = input.trim();
    if (/^[\w-]{11}$/.test(text)) return { videoId: text };
    try {
      const u = new URL(text.startsWith('http') ? text : `https://${text}`);
      const list = u.searchParams.get('list') || undefined;
      let v = u.searchParams.get('v') || undefined;
      if (!v && u.hostname.endsWith('youtu.be')) v = u.pathname.slice(1, 12);
      const m = u.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/);
      if (!v && m) v = m[2];
      return { videoId: v && /^[\w-]{11}$/.test(v) ? v : undefined, listId: list };
    } catch {
      return {};
    }
  }

  /** Title and channel for a video, without an API key */
  async videoInfo(id: string): Promise<YouTubeVideo> {
    const watch = `https://www.youtube.com/watch?v=${id}`;
    const fallback: YouTubeVideo = { id, title: 'YouTube video', artist: 'YouTube', thumb: this.thumb(id) };
    const sources = [
      `https://noembed.com/embed?url=${encodeURIComponent(watch)}`,
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`,
    ];
    for (const url of sources) {
      try {
        const r: any = await firstValueFrom(this.http.get(url).pipe(timeout(8000)));
        if (r?.title) return { ...this.splitTitle(r.title, r.author_name), id, thumb: this.thumb(id) };
      } catch {
        /* try the next one */
      }
    }
    return fallback;
  }

  /**
   * Video ids in a playlist. With a key we use the Data API; without one we
   * briefly cue the playlist in a visible player inside `host` and read it back.
   */
  async playlistIds(listId: string, host: HTMLElement): Promise<string[]> {
    if (this.hasKey()) {
      const ids: string[] = [];
      let page = '';
      for (let i = 0; i < 4; i++) {
        const qs = new URLSearchParams({ part: 'contentDetails', maxResults: '50', playlistId: listId, key: this.apiKey() });
        if (page) qs.set('pageToken', page);
        const r: any = await firstValueFrom(this.http.get(`https://www.googleapis.com/youtube/v3/playlistItems?${qs}`));
        ids.push(...(r.items || []).map((it: any) => it.contentDetails?.videoId).filter(Boolean));
        page = r.nextPageToken;
        if (!page) break;
      }
      return ids;
    }

    const YT = await this.loadApi();
    const mount = document.createElement('div');
    host.appendChild(mount);
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (ids: string[] | null, err?: Error) => {
        if (done) return;
        done = true;
        try { player.destroy(); } catch { /* already gone */ }
        mount.remove();
        if (ids) resolve(ids); else reject(err);
      };
      const player = new YT.Player(mount, {
        width: 200,
        height: 200,
        playerVars: { playsinline: 1 },
        events: {
          onReady: () => player.cuePlaylist({ listType: 'playlist', list: listId }),
          onStateChange: () => {
            const ids = player.getPlaylist?.();
            if (ids?.length) finish(ids);
          },
          onError: () => finish(null, new Error('Playlist is private or unavailable')),
        },
      });
      setTimeout(() => finish(null, new Error('Timed out reading the playlist')), 15000);
    });
  }

  // ── Search (needs a key) ──

  search(query: string, limit = 12): Observable<Track[]> {
    if (!this.hasKey() || !query.trim()) return of([]);
    const cacheKey = `s:${query.toLowerCase()}:${limit}`;
    const cached = this.cacheGet<YouTubeVideo[]>(cacheKey);
    if (cached) return of(cached.map((v) => this.toTrack(v)));

    const qs = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      maxResults: String(limit),
      q: query,
      key: this.apiKey(),
    });
    return this.http.get<any>(`https://www.googleapis.com/youtube/v3/search?${qs}`).pipe(
      timeout(10000),
      map((r) =>
        (r.items || [])
          .filter((it: any) => it.id?.videoId)
          .map((it: any): YouTubeVideo => ({
            ...this.splitTitle(this.decode(it.snippet.title), it.snippet.channelTitle),
            id: it.id.videoId,
            thumb: it.snippet.thumbnails?.high?.url || this.thumb(it.id.videoId),
          }))
      ),
      switchMap((vids: YouTubeVideo[]) => this.withDurations(vids)),
      map((vids) => {
        // Skip shorts and hour-long mixes
        const songs = vids.filter((v) => !v.duration || (v.duration >= 60 && v.duration <= 15 * 60));
        this.cacheSet(cacheKey, songs);
        return songs.map((v) => this.toTrack(v));
      }),
      catchError((err) => {
        console.warn('[YouTube] search failed', err);
        return of([]);
      })
    );
  }

  /** Best full-length YouTube match for a track (e.g. a 30s preview) */
  findFullVersion(track: Track): Observable<string | null> {
    const key = `${track.artist_name}|${track.name}`.toLowerCase();
    const known = this.read<Record<string, string>>(FULL_STORAGE) || {};
    if (key in known) return of(known[key] || null);
    return this.search(`${track.artist_name} ${track.name}`, 5).pipe(
      map((results) => {
        const title = track.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
        const best = results.find((r) => r.name.toLowerCase().includes(title)) || results[0];
        const id = YouTubeService.idOf(best) || '';
        this.write(FULL_STORAGE, { ...known, [key]: id });
        return id || null;
      })
    );
  }

  toTrack(v: YouTubeVideo): Track {
    return {
      id: `yt-${v.id}`,
      name: v.title,
      artist_name: v.artist,
      artist_id: '',
      album_name: 'YouTube',
      album_id: '',
      album_image: v.thumb,
      duration: v.duration || 0,
      audio: `${YT_PREFIX}${v.id}`,
      audiodownload: '',
      image: v.thumb,
      releasedate: '',
      position: 1,
      provider: 'youtube',
      externalUrl: `https://www.youtube.com/watch?v=${v.id}`,
    };
  }

  thumb(id: string): string {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  /** Quick check that a key works (costs 1 quota unit) */
  testKey(key: string): Observable<boolean> {
    const qs = new URLSearchParams({ part: 'id', id: 'dQw4w9WgXcQ', key: key.trim() });
    return this.http.get<any>(`https://www.googleapis.com/youtube/v3/videos?${qs}`).pipe(
      timeout(8000),
      map((r) => Array.isArray(r?.items)),
      catchError(() => of(false))
    );
  }

  // ── Helpers ──

  private withDurations(vids: YouTubeVideo[]): Observable<YouTubeVideo[]> {
    if (!vids.length) return of(vids);
    const qs = new URLSearchParams({ part: 'contentDetails', id: vids.map((v) => v.id).join(','), key: this.apiKey() });
    return this.http.get<any>(`https://www.googleapis.com/youtube/v3/videos?${qs}`).pipe(
      map((r) => {
        const d = new Map<string, number>((r.items || []).map((it: any) => [it.id, this.isoDuration(it.contentDetails?.duration)]));
        return vids.map((v) => ({ ...v, duration: d.get(v.id) || 0 }));
      }),
      catchError(() => of(vids))
    );
  }

  /** "Artist - Song (Official Video)" → { artist, title } */
  private splitTitle(raw: string, channel = ''): { title: string; artist: string } {
    const clean = raw
      .replace(/\s*[([](official|lyrical?|lyrics?|full|hd|4k|video|audio|music video|mv)[^)\]]*[)\]]/gi, '')
      .replace(/\s*\|.*$/, '')
      .trim();
    const parts = clean.split(/\s+[-–—]\s+/);
    const artist = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
    if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    return { title: clean || raw, artist: artist || 'YouTube' };
  }

  private isoDuration(iso = ''): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }

  private decode(s: string): string {
    const t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }

  private cacheGet<T>(k: string): T | null {
    const all = this.read<Record<string, { at: number; v: T }>>(CACHE_STORAGE) || {};
    const hit = all[k];
    return hit && Date.now() - hit.at < CACHE_TTL ? hit.v : null;
  }

  private cacheSet<T>(k: string, v: T): void {
    const all = this.read<Record<string, { at: number; v: T }>>(CACHE_STORAGE) || {};
    all[k] = { at: Date.now(), v };
    // Keep the cache small
    const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 150);
    this.write(CACHE_STORAGE, Object.fromEntries(entries));
  }

  private read<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked */
    }
  }

  /** Metadata for many ids, 4 at a time */
  async videosInfo(ids: string[], onProgress?: (done: number) => void): Promise<YouTubeVideo[]> {
    const out: YouTubeVideo[] = new Array(ids.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < ids.length) {
        const i = next++;
        out[i] = await this.videoInfo(ids[i]);
        onProgress?.(++done);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return out;
  }
}
