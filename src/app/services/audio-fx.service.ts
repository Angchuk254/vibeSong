// ============================================
// YakBeats — Sound: equalizer, crossfade and smooth fades
// ============================================
// The equalizer runs the <audio> elements through the Web Audio API. That
// only works for audio the browser may "read" (your own files, Audius,
// iTunes previews…); everything else — YouTube and many radio stations —
// still plays, just without the equalizer. The player takes care of that.

import { Injectable, signal } from '@angular/core';

/** Centre frequencies of the five bands (Hz) */
export const EQ_BANDS = [60, 230, 910, 3600, 14000];
export const EQ_LIMIT = 12; // dB

export interface EqPreset {
  id: string;
  name: string;
  gains: number[];
}

export const EQ_PRESETS: EqPreset[] = [
  { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0] },
  { id: 'bass', name: 'Bass boost', gains: [7, 4, 0, -1, 0] },
  { id: 'vocal', name: 'Vocals', gains: [-2, -1, 3, 4, 1] },
  { id: 'folk', name: 'Folk & flute', gains: [1, 0, 2, 3, 4] },
  { id: 'party', name: 'Party', gains: [5, 2, -1, 2, 4] },
  { id: 'car', name: 'Car', gains: [5, 2, 0, 2, 3] },
  { id: 'treble', name: 'Treble', gains: [0, 0, 0, 3, 6] },
  { id: 'night', name: 'Soft night', gains: [-2, 0, 0, -2, -5] },
];

export const CROSSFADE_OPTIONS = [0, 3, 6, 10];

interface FxPrefs {
  eq: boolean;
  preset: string;
  gains: number[];
  crossfade: number;
  smooth: boolean;
}

const KEY = 'vo_sound';

@Injectable({ providedIn: 'root' })
export class AudioFxService {
  private prefs = this.load();

  readonly eqOn = signal(this.prefs.eq);
  readonly preset = signal(this.prefs.preset);
  readonly gains = signal<number[]>(this.prefs.gains);
  /** Seconds the end of one song overlaps the start of the next (0 = off) */
  readonly crossfade = signal(this.prefs.crossfade);
  /** Fade in/out when pausing and resuming */
  readonly smoothFades = signal(this.prefs.smooth);
  /** The browser lets us change an element's volume (iPhone/iPad don't) */
  readonly canFade = this.detectVolumeControl();
  readonly canEq = typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext);

  private ctx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private routed = new WeakSet<HTMLMediaElement>();
  /** Called when the equalizer is first switched on, so the player can connect its elements */
  onFirstEnable: (() => void) | null = null;

  /** Whether an element's sound goes through the equalizer */
  isRouted(el: HTMLMediaElement): boolean {
    return this.routed.has(el);
  }

  /** Something is connected (so cross-origin audio must allow it) */
  get active(): boolean {
    return !!this.ctx;
  }

  setEq(on: boolean): void {
    if (on && !this.canEq) return;
    this.eqOn.set(on);
    this.save();
    if (on && !this.ctx) this.onFirstEnable?.();
    this.applyGains();
  }

  setPreset(id: string): void {
    const p = EQ_PRESETS.find((x) => x.id === id);
    if (!p) return;
    this.preset.set(id);
    this.gains.set([...p.gains]);
    if (!this.eqOn()) this.setEq(true);
    this.save();
    this.applyGains();
  }

  setGain(band: number, db: number): void {
    const g = [...this.gains()];
    g[band] = Math.max(-EQ_LIMIT, Math.min(EQ_LIMIT, Math.round(db)));
    this.gains.set(g);
    this.preset.set(EQ_PRESETS.find((p) => p.gains.every((v, i) => v === g[i]))?.id || 'custom');
    this.save();
    this.applyGains();
  }

  setCrossfade(seconds: number): void {
    this.crossfade.set(this.canFade ? seconds : 0);
    this.save();
  }

  setSmoothFades(on: boolean): void {
    this.smoothFades.set(on);
    this.save();
  }

  /**
   * Send these elements through the equalizer. They must load audio with
   * CORS from now on (crossOrigin), or the browser would play silence.
   */
  route(elements: HTMLMediaElement[]): void {
    if (!this.canEq) return;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new Ctx() as AudioContext;
        this.filters = EQ_BANDS.map((f, i) => {
          const b = this.ctx!.createBiquadFilter();
          b.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
          b.frequency.value = f;
          b.Q.value = 1;
          return b;
        });
        this.filters.reduce((a, b) => (a.connect(b), b));
        this.filters[this.filters.length - 1].connect(this.ctx.destination);
      }
      for (const el of elements) {
        if (this.routed.has(el)) continue;
        el.crossOrigin = 'anonymous';
        this.ctx.createMediaElementSource(el).connect(this.filters[0]);
        this.routed.add(el);
      }
      this.applyGains();
    } catch (e) {
      console.warn('[Sound] Equalizer unavailable', e);
    }
  }

  /** Browsers start audio contexts paused until the user taps something */
  resume(): Promise<void> {
    if (!this.ctx || this.ctx.state === 'running') return Promise.resolve();
    return this.ctx.resume().catch(() => undefined);
  }

  /** The equalizer is ready to make sound right now */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  // ── Volume fades (work without the equalizer) ──

  private fades = new Map<HTMLMediaElement, number>();

  /** Smoothly move an element's volume to `to` (0–1, or read live) over `ms` */
  fadeTo(el: HTMLMediaElement, to: number | (() => number), ms: number): Promise<void> {
    this.cancelFade(el);
    const target = () => Math.max(0, Math.min(1, typeof to === 'function' ? to() : to));
    if (!this.canFade || ms <= 0) {
      el.volume = target();
      return Promise.resolve();
    }
    const from = el.volume;
    const start = Date.now();
    return new Promise((resolve) => {
      const id = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / ms);
        // Ease so the change sounds even to the ear
        el.volume = Math.max(0, Math.min(1, from + (target() - from) * (t * t * (3 - 2 * t))));
        if (t >= 1) {
          this.cancelFade(el);
          resolve();
        }
      }, 40);
      this.fades.set(el, id);
    });
  }

  cancelFade(el: HTMLMediaElement): void {
    const id = this.fades.get(el);
    if (id !== undefined) window.clearInterval(id);
    this.fades.delete(el);
  }

  // ── Internals ──

  private applyGains(): void {
    const on = this.eqOn();
    const g = this.gains();
    this.filters.forEach((f, i) => (f.gain.value = on ? g[i] || 0 : 0));
  }

  private detectVolumeControl(): boolean {
    try {
      const a = new Audio();
      a.volume = 0.5;
      return Math.abs(a.volume - 0.5) < 0.01;
    } catch {
      return false;
    }
  }

  private load(): FxPrefs {
    const def: FxPrefs = { eq: false, preset: 'flat', gains: [0, 0, 0, 0, 0], crossfade: 0, smooth: true };
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!p) return def;
      const gains = Array.isArray(p.gains) && p.gains.length === EQ_BANDS.length ? p.gains.map(Number) : def.gains;
      return { ...def, ...p, gains };
    } catch {
      return def;
    }
  }

  private save(): void {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ eq: this.eqOn(), preset: this.preset(), gains: this.gains(), crossfade: this.crossfade(), smooth: this.smoothFades() })
      );
    } catch {
      /* ignore */
    }
  }
}
