// ============================================
// YakBeats — Data saver + data used
// ============================================
// For mountain mobile data: when active it
// - loads small cover art instead of big pictures,
// - picks lower-bitrate radio streams (≤128 kbps) when a station list has them,
// - doesn't swap 30-second previews for full YouTube videos by itself (video
//   uses far more data) — you can still play YouTube songs yourself.
// "Auto" switches it on for mobile data / the phone's own Data Saver, and
// off on Wi-Fi. Data used is an estimate from what played and for how long.

import { Injectable, computed, signal } from '@angular/core';
import { Track } from '../models';

export type SaverMode = 'auto' | 'on' | 'off';
export type Network = 'mobile' | 'wifi' | 'unknown';

interface NetInfo extends EventTarget {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
}

interface DayUsage {
  day: string; // YYYY-MM-DD
  mobile: number; // bytes
  wifi: number;
  unknown: number;
}

const MODE_KEY = 'vo_data_saver';
const USAGE_KEY = 'vo_data_usage';

/** Rough stream sizes (kilobits per second) used for the estimate */
export function estimateKbps(track: Track, youtube: boolean, saver: boolean): number {
  if (youtube) return saver ? 500 : 900; // video + audio; smaller player picks lower quality
  if (track.audio?.startsWith('device:') || track.provider === 'device') return 0;
  if (track.isLive) return track.bitrate || 128;
  if (track.isPreview || track.provider === 'itunes') return 256;
  if (track.provider === 'archive') return 192;
  return 256; // Audius and uploads
}

@Injectable({ providedIn: 'root' })
export class DataSaverService {
  private conn: NetInfo | null = (typeof navigator !== 'undefined' && (navigator as any).connection) || null;

  readonly mode = signal<SaverMode>(this.readMode());
  /** Bumped when the connection changes */
  private netTick = signal(0);

  readonly network = computed<Network>(() => {
    this.netTick();
    const t = this.conn?.type;
    if (t === 'cellular') return 'mobile';
    if (t === 'wifi' || t === 'ethernet') return 'wifi';
    return 'unknown';
  });

  /** The phone itself asked to save data, or the connection is very slow */
  readonly phoneWantsSaving = computed(() => {
    this.netTick();
    return !!this.conn?.saveData || this.conn?.effectiveType === '2g' || this.conn?.effectiveType === 'slow-2g';
  });

  readonly active = computed(() => {
    const m = this.mode();
    if (m === 'on') return true;
    if (m === 'off') return false;
    return this.network() === 'mobile' || this.phoneWantsSaving();
  });

  /** Why it is (not) on right now, for Settings */
  readonly reason = computed(() => {
    const m = this.mode();
    if (m === 'on') return 'On all the time';
    if (m === 'off') return 'Off';
    if (this.phoneWantsSaving()) return 'On — your phone’s Data Saver or a slow connection';
    if (this.network() === 'mobile') return 'On — you’re on mobile data';
    if (this.network() === 'wifi') return 'Off — you’re on Wi-Fi';
    return 'Off — this browser doesn’t say whether you’re on mobile data';
  });

  readonly usage = signal<DayUsage[]>(this.readUsage());

  constructor() {
    this.conn?.addEventListener?.('change', () => this.netTick.update((n) => n + 1));
  }

  setMode(m: SaverMode): void {
    this.mode.set(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }

  /** Smaller version of a cover picture when saving data */
  art(url: string | undefined | null, saver = this.active()): string {
    if (!url || !saver) return url || '';
    return url
      .replace(/\/(480x480|1000x1000)\.(jpg|jpeg|png|webp)/i, '/150x150.$2') // Audius
      .replace(/\/\d{3,4}x\d{3,4}bb\./, '/200x200bb.') // iTunes
      .replace(/([?&])w=\d+/, '$1w=160'); // Unsplash placeholders
  }

  /** Put lower-bitrate radio streams first (unknown bitrates count as fine) */
  preferLight(stations: Track[]): Track[] {
    if (!this.active()) return stations;
    const heavy = (t: Track) => (t.bitrate || 0) > 128;
    return [...stations.filter((t) => !heavy(t)), ...stations.filter(heavy)];
  }

  /** Add an estimated amount of data to today's total */
  addBytes(bytes: number): void {
    if (bytes <= 0) return;
    const day = this.dayKey();
    const net = this.network();
    const list = this.usage().filter((d) => d.day >= this.dayKey(-6)); // keep a week
    let today = list.find((d) => d.day === day);
    if (!today) {
      today = { day, mobile: 0, wifi: 0, unknown: 0 };
      list.push(today);
    }
    today[net] += bytes;
    this.usage.set([...list]);
  }

  /** Write the running totals to storage (not on every tick) */
  persist(): void {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(this.usage()));
    } catch {
      /* ignore */
    }
  }

  today(): DayUsage {
    return this.usage().find((d) => d.day === this.dayKey()) || { day: this.dayKey(), mobile: 0, wifi: 0, unknown: 0 };
  }

  week(): number {
    return this.usage().reduce((sum, d) => sum + d.mobile + d.wifi + d.unknown, 0);
  }

  resetUsage(): void {
    this.usage.set([]);
    this.persist();
  }

  static format(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '0 MB';
    if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  private dayKey(offset = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private readMode(): SaverMode {
    try {
      const m = localStorage.getItem(MODE_KEY);
      return m === 'on' || m === 'off' ? m : 'auto';
    } catch {
      return 'auto';
    }
  }

  private readUsage(): DayUsage[] {
    try {
      const u = JSON.parse(localStorage.getItem(USAGE_KEY) || '[]');
      return Array.isArray(u) ? u : [];
    } catch {
      return [];
    }
  }
}
