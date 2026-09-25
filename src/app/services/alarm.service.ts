// ============================================
// YakBeats — Radio alarm, night clock and car mode
// ============================================
// Wake up to a radio station, Liked Songs, My Songs or a category. Browsers
// only run timers while the app is open, so the alarm rings when YakBeats is
// open — the night clock keeps the screen on (plug the phone in) so it
// can't fall asleep. If the chosen music can't start (no internet, say),
// My Songs or a built-in chime plays instead, so it always makes a sound.

import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { Track } from '../models';
import { MUSIC_CATEGORIES } from '../core/categories.data';
import { PlayerService } from './player.service';
import { StorageService } from './storage.service';
import { DeviceMusicService } from './device-music.service';
import { MusicApiService } from './music-api.service';
import { WakeLockService } from './wake-lock.service';

export type AlarmSource =
  | { kind: 'liked' }
  | { kind: 'mysongs' }
  | { kind: 'category'; id: string }
  | { kind: 'track'; track: Track };

export interface Alarm {
  enabled: boolean;
  /** "HH:MM", 24-hour */
  time: string;
  /** Days of the week it repeats on (0 = Sunday); empty = just once */
  days: number[];
  source: AlarmSource;
  /** Start quietly and get louder over a minute */
  gentle: boolean;
  /** Date (YYYY-MM-DD) it last rang, so it rings once per day */
  lastRang?: string;
}

const KEY = 'vo_alarm';
const SNOOZE_MIN = 9;
/** Still ring if the phone kept us from checking for this long */
const GRACE_MIN = 5;

@Injectable({ providedIn: 'root' })
export class AlarmService {
  private player = inject(PlayerService);
  private storage = inject(StorageService);
  private device = inject(DeviceMusicService);
  private musicApi = inject(MusicApiService);
  private wake = inject(WakeLockService);

  readonly alarm = signal<Alarm | null>(this.load());
  readonly ringing = signal(false);
  readonly snoozedUntil = signal<number | null>(null);
  /** Screens */
  readonly sheetOpen = signal(false);
  readonly nightClock = signal(false);
  readonly carMode = signal(false);
  /** Ticks every few seconds for clocks and countdowns */
  readonly now = signal(Date.now());

  readonly nextRing = computed(() => {
    this.now();
    const a = this.alarm();
    if (this.snoozedUntil()) return new Date(this.snoozedUntil()!);
    return a?.enabled ? this.nextTime(a) : null;
  });

  private chime: HTMLAudioElement | null = null;
  private ramp: ReturnType<typeof setInterval> | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    setInterval(() => {
      this.now.set(Date.now());
      this.check();
    }, 5000);
    // Returning to the app after the phone paused us: check straight away
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.check());
  }

  // ── Setting the alarm ──

  save(a: Omit<Alarm, 'enabled' | 'lastRang'>): void {
    const alarm: Alarm = { ...a, enabled: true };
    // Set for a time a few minutes ago: don't ring straight away, start tomorrow
    const now = new Date();
    const [h, m] = a.time.split(':').map(Number);
    const late = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    if (late >= 0 && late <= GRACE_MIN) alarm.lastRang = this.dayKey(now);
    this.alarm.set(alarm);
    this.snoozedUntil.set(null);
    this.persist();
    this.askForNotifications();
  }

  turnOff(): void {
    const a = this.alarm();
    if (a) this.alarm.set({ ...a, enabled: false });
    this.snoozedUntil.set(null);
    this.persist();
  }

  /** "Wake-up music" label for a source */
  sourceName(s: AlarmSource): string {
    switch (s.kind) {
      case 'liked': return 'Liked Songs';
      case 'mysongs': return 'My Songs';
      case 'category': return MUSIC_CATEGORIES.find((c) => c.id === s.id)?.name || 'Music';
      case 'track': return s.track.name;
    }
  }

  /** Music for a source (radio stations, songs…) — also used by car mode */
  async tracksFor(s: AlarmSource): Promise<Track[]> {
    switch (s.kind) {
      case 'liked': return this.storage.getFavorites();
      case 'mysongs':
        await this.device.ready;
        return this.device.tracks().filter((t) => DeviceMusicService.isDeviceTrack(t));
      case 'track': return [s.track];
      case 'category': {
        const cat = MUSIC_CATEGORIES.find((c) => c.id === s.id);
        if (!cat) return [];
        try {
          return await firstValueFrom(this.musicApi.getCategoryTracks(cat, 20).pipe(timeout(15000)));
        } catch {
          return [];
        }
      }
    }
  }

  /** Start a source playing (shuffled, except a single station/song) */
  async play(s: AlarmSource): Promise<boolean> {
    const tracks = await this.tracksFor(s);
    if (!tracks.length) return false;
    const first = s.kind === 'track' || tracks[0].isLive ? tracks[0] : tracks[Math.floor(Math.random() * tracks.length)];
    this.player.playTrack(first, tracks);
    return true;
  }

  // ── Ringing ──

  snooze(): void {
    this.silence();
    this.player.isPlaying() && this.player.togglePlay();
    this.snoozedUntil.set(Date.now() + SNOOZE_MIN * 60000);
  }

  /** Stop the alarm; `keepMusic` leaves the wake-up music playing */
  stop(keepMusic = false): void {
    this.silence();
    this.snoozedUntil.set(null);
    if (!keepMusic && this.player.isPlaying()) this.player.togglePlay();
  }

  /** Try the alarm now (from the alarm sheet) */
  test(): void {
    this.ring(true);
  }

  /** Time left until the alarm, e.g. "7 h 20 min" */
  countdown(): string {
    const at = this.nextRing();
    if (!at) return '';
    const mins = Math.max(0, Math.round((at.getTime() - this.now()) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h} h ${mins % 60} min` : `${mins} min`;
  }

  // ── Internals ──

  private check(): void {
    const snooze = this.snoozedUntil();
    if (snooze && Date.now() >= snooze) {
      this.snoozedUntil.set(null);
      this.ring(true);
      return;
    }
    const a = this.alarm();
    if (!a?.enabled || this.ringing()) return;
    const now = new Date();
    const today = this.dayKey(now);
    if (a.lastRang === today) return;
    const [h, m] = a.time.split(':').map(Number);
    const late = now.getHours() * 60 + now.getMinutes() - (h * 60 + m);
    if (late < 0 || late > GRACE_MIN) return;
    if (a.days.length && !a.days.includes(now.getDay())) return;
    this.alarm.set({ ...a, lastRang: today, enabled: a.days.length > 0 });
    this.persist();
    this.ring(false);
  }

  private async ring(isRetry: boolean): Promise<void> {
    const a = this.alarm();
    this.ringing.set(true);
    this.wake.acquire('alarm');
    this.notify(a);
    navigator.vibrate?.([400, 200, 400, 200, 400]);

    const source = a?.source || { kind: 'category', id: 'radio-himalayan' };
    const target = this.player.volume() || 0.8;
    const gentle = !!a?.gentle && !isRetry;
    if (gentle) this.player.setVolume(Math.max(0.05, target * 0.1));

    let started = await this.play(source).catch(() => false);
    if (!started) started = await this.play({ kind: 'mysongs' }).catch(() => false);
    if (gentle) this.rampTo(target);

    // Nothing audible after a while (offline, station down…): sound the chime
    this.fallbackTimer = setTimeout(() => {
      if (this.ringing() && !this.player.isPlaying()) {
        if (gentle) this.player.setVolume(target);
        this.playChime();
      }
    }, started ? 20000 : 500);
  }

  private silence(): void {
    this.ringing.set(false);
    this.wake.release('alarm');
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
    if (this.ramp) clearInterval(this.ramp);
    this.ramp = null;
    this.chime?.pause();
    this.chime = null;
    navigator.vibrate?.(0);
  }

  /** Get louder over a minute, unless the listener changes the volume themselves */
  private rampTo(target: number): void {
    if (this.ramp) clearInterval(this.ramp);
    const start = Date.now();
    let last = this.player.volume();
    this.ramp = setInterval(() => {
      if (Math.abs(this.player.volume() - last) > 0.01 || !this.ringing()) {
        clearInterval(this.ramp!);
        this.ramp = null;
        return;
      }
      const t = Math.min(1, (Date.now() - start) / 60000);
      last = Math.max(0.05, target * (0.1 + 0.9 * t));
      this.player.setVolume(last);
      if (t >= 1) {
        clearInterval(this.ramp!);
        this.ramp = null;
      }
    }, 2000);
  }

  /** A soft two-note chime, made on the spot so it works offline */
  private playChime(): void {
    if (this.chime) return;
    const rate = 22050;
    const secs = 2;
    const n = rate * secs;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const note = t < 0.6 ? 880 : t < 1.2 ? 660 : 0; // ding… dong… (rest)
      const local = t < 0.6 ? t : t - 0.6;
      const env = note ? Math.exp(-local * 4) : 0;
      v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * note * t) * env * 0.6 * 32767, true);
    }
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    a.loop = true;
    a.volume = 1;
    this.chime = a;
    a.play().catch(() => undefined);
  }

  /** A system notification too (if allowed), so the alarm shows on the lock screen */
  private async notify(a: Alarm | null): Promise<void> {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const reg = await navigator.serviceWorker?.getRegistration();
      const body = a ? `Waking you up with ${this.sourceName(a.source)}` : 'Time to wake up';
      const opts: NotificationOptions & Record<string, unknown> = {
        body,
        tag: 'yakbeats-alarm',
        requireInteraction: true,
        icon: 'icons/icon-192x192.png',
        vibrate: [400, 200, 400],
        // Tapping it opens the app (Angular service worker)
        data: { onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: './' } } },
      };
      if (reg) await reg.showNotification('⏰ Julley! Rise and shine', opts);
      else new Notification('⏰ Julley! Rise and shine', opts);
    } catch {
      /* notifications unavailable */
    }
  }

  private askForNotifications(): void {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }

  private nextTime(a: Alarm): Date | null {
    const [h, m] = a.time.split(':').map(Number);
    const now = new Date(this.now());
    for (let add = 0; add < 8; add++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, h, m);
      if (d.getTime() + GRACE_MIN * 60000 <= now.getTime()) continue;
      if (add === 0 && a.lastRang === this.dayKey(now)) continue;
      if (a.days.length && !a.days.includes(d.getDay())) continue;
      return d;
    }
    return null;
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private load(): Alarm | null {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.alarm()));
    } catch {
      /* ignore */
    }
  }
}
