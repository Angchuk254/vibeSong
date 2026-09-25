// ============================================
// YakBeats — Radio alarm: set it, night clock, wake-up screen
// ============================================

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AlarmService, AlarmSource } from '../../services/alarm.service';
import { PlayerService } from '../../services/player.service';
import { BackService } from '../../services/back.service';
import { WakeLockService } from '../../services/wake-lock.service';
import { MUSIC_CATEGORIES } from '../../core/categories.data';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-alarm',
  standalone: true,
  template: `
    <!-- Set the alarm -->
    @if (alarms.sheetOpen()) {
      <div class="al-backdrop" (click)="alarms.sheetOpen.set(false)"></div>
      <div class="al-sheet" role="dialog" aria-label="Radio alarm">
        <div class="al-sheet__head">
          <h2><i class="bi bi-alarm"></i> Radio alarm</h2>
          <button class="al-x" (click)="alarms.sheetOpen.set(false)" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </div>

        <input class="al-time" type="time" [value]="time()" (input)="time.set($any($event.target).value || time())" aria-label="Alarm time" />

        <div class="al-days" role="group" aria-label="Repeat">
          <button class="al-chip" [class.on]="!days().length" (click)="days.set([])">Once</button>
          <button class="al-chip" [class.on]="days().length === 7" (click)="days.set([0,1,2,3,4,5,6])">Every day</button>
          <button class="al-chip" [class.on]="isWeekdays()" (click)="days.set([1,2,3,4,5])">Weekdays</button>
        </div>
        <div class="al-days al-days--letters">
          @for (d of dayLetters; track $index) {
            <button class="al-day" [class.on]="days().includes($index)" (click)="toggleDay($index)"
                    [attr.aria-label]="dayNames[$index]" [attr.aria-pressed]="days().includes($index)">{{ d }}</button>
          }
        </div>

        <label class="al-field">
          <span>Wake me with</span>
          <select (change)="sourceKey.set($any($event.target).value)">
            @if (current(); as t) {
              <option value="current" [selected]="sourceKey() === 'current'">▶ What's playing: {{ t.name }}</option>
            }
            @if (savedTrack(); as t) {
              <option value="saved-track" [selected]="sourceKey() === 'saved-track'">▶ {{ t.name }}</option>
            }
            <optgroup label="Live radio">
              @for (c of radioCats; track c.id) { <option [value]="'cat:' + c.id" [selected]="sourceKey() === 'cat:' + c.id">📻 {{ c.name }}</option> }
            </optgroup>
            <optgroup label="Your music">
              <option value="liked" [selected]="sourceKey() === 'liked'">❤️ Liked Songs</option>
              <option value="mysongs" [selected]="sourceKey() === 'mysongs'">📱 My Songs (works offline)</option>
            </optgroup>
            <optgroup label="Songs">
              @for (c of songCats; track c.id) { <option [value]="'cat:' + c.id" [selected]="sourceKey() === 'cat:' + c.id">🎵 {{ c.name }}</option> }
            </optgroup>
          </select>
        </label>

        <button class="al-row" role="switch" [attr.aria-checked]="gentle()" (click)="gentle.set(!gentle())">
          <span><strong>Gentle wake</strong><small>Starts quiet, gets louder over a minute</small></span>
          <span class="al-toggle" [class.on]="gentle()"><span></span></span>
        </button>

        <p class="al-note">
          <i class="bi bi-info-circle"></i>
          Rings while YakBeats is open. Before bed, start the <strong>night clock</strong> and leave your phone charging —
          it keeps the screen on so the alarm can't be missed. No internet in the morning? It plays My Songs or a chime.
        </p>

        <div class="al-actions">
          <button class="vo-btn vo-btn-primary" (click)="save()"><i class="bi bi-check-lg"></i> Save alarm</button>
          <button class="vo-btn vo-btn-ghost" (click)="startNight()"><i class="bi bi-moon-stars"></i> Night clock</button>
          @if (alarms.alarm()?.enabled) {
            <button class="vo-btn vo-btn-ghost" (click)="alarms.turnOff()"><i class="bi bi-bell-slash"></i> Turn off</button>
          }
          <button class="vo-btn vo-btn-ghost" (click)="test()"><i class="bi bi-volume-up"></i> Test</button>
        </div>
        @if (alarms.nextRing(); as at) {
          <p class="al-next">Next alarm {{ dayLabel(at) }} at {{ clock(at) }} · in {{ alarms.countdown() }}</p>
        }
      </div>
    }

    <!-- Night clock: screen stays on, very dim -->
    @if (alarms.nightClock() && !alarms.ringing()) {
      <div class="al-night" [class.dim]="dim()" (click)="dim.set(!dim())">
        <div class="al-night__time">{{ clock(nowDate()) }}</div>
        <div class="al-night__date">{{ longDate(nowDate()) }}</div>
        @if (alarms.nextRing(); as at) {
          <div class="al-night__alarm"><i class="bi bi-alarm"></i> {{ clock(at) }} · in {{ alarms.countdown() }}</div>
        } @else {
          <div class="al-night__alarm muted">No alarm set</div>
        }
        @if (player.currentTrack(); as t) {
          <div class="al-night__playing">
            <i class="bi" [class.bi-music-note-beamed]="player.isPlaying()" [class.bi-pause]="!player.isPlaying()"></i>
            {{ t.name }}
            @if (player.sleepAt() !== null) { <span> · sleep timer on</span> }
          </div>
        }
        <div class="al-night__actions" (click)="$event.stopPropagation()">
          <button (click)="alarms.sheetOpen.set(true)"><i class="bi bi-alarm"></i> Alarm</button>
          <button (click)="sleep()"><i class="bi bi-moon"></i> Sleep 30 min</button>
          <button (click)="alarms.nightClock.set(false)"><i class="bi bi-x-lg"></i> Exit</button>
        </div>
        <p class="al-night__hint">Tap to change brightness · keep the phone charging</p>
      </div>
    }

    <!-- Wake up! -->
    @if (alarms.ringing()) {
      <div class="al-ring" role="alertdialog" aria-label="Alarm">
        <div class="al-ring__sun"></div>
        <div class="al-ring__time">{{ clock(nowDate()) }}</div>
        <h2>Julley! Rise and shine ☀️</h2>
        @if (player.currentTrack(); as t) {
          <p class="al-ring__playing"><i class="bi bi-broadcast"></i> {{ t.name }}</p>
        }
        <div class="al-ring__actions">
          <button class="big" (click)="alarms.snooze()"><i class="bi bi-hourglass-split"></i><span>Snooze 9 min</span></button>
          <button class="big stop" (click)="alarms.stop()"><i class="bi bi-stop-fill"></i><span>Stop</span></button>
        </div>
        <button class="al-ring__keep" (click)="alarms.stop(true)">Keep the music playing</button>
      </div>
    }
  `,
  styles: [`
    :host { position: relative; z-index: 4000; }
    .al-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 4000; }
    .al-sheet {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 4001;
      max-height: 92dvh; overflow-y: auto;
      background: var(--vo-bg-secondary); border-radius: 22px 22px 0 0;
      padding: 18px 18px calc(18px + env(safe-area-inset-bottom, 0px));
      box-shadow: var(--vo-shadow-lg);
      animation: al-up .22s ease;
    }
    @media (min-width: 769px) {
      .al-sheet { left: 50%; right: auto; bottom: auto; top: 50%; transform: translate(-50%, -50%); width: 460px; border-radius: 22px; animation: none; }
    }
    @keyframes al-up { from { transform: translateY(40px); opacity: 0; } }
    .al-sheet__head { display: flex; align-items: center; justify-content: space-between; }
    .al-sheet__head h2 { font-size: 1.2rem; margin: 0; display: flex; gap: 8px; align-items: center; }
    .al-x { background: none; border: 0; color: var(--vo-text-secondary); font-size: 1.1rem; padding: 8px; cursor: pointer; }
    .al-time {
      display: block; width: 100%; margin: 12px 0 14px; text-align: center;
      font: 700 3rem/1.1 var(--vo-font-display); color: var(--vo-text-primary);
      background: var(--vo-bg-input); border: 1px solid var(--vo-border); border-radius: 16px; padding: 10px;
      color-scheme: dark;
    }
    .al-days { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .al-days--letters { justify-content: space-between; flex-wrap: nowrap; }
    .al-chip, .al-day {
      border: 1px solid var(--vo-border-light); background: transparent; color: var(--vo-text-secondary);
      border-radius: 999px; padding: 7px 14px; font-size: .85rem; cursor: pointer;
    }
    .al-day { width: 40px; height: 40px; padding: 0; font-weight: 700; flex: 0 0 auto; }
    .al-chip.on, .al-day.on { background: var(--vo-accent); border-color: var(--vo-accent); color: #fff; }
    .al-field { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 12px; font-size: .85rem; color: var(--vo-text-secondary); }
    .al-field select {
      width: 100%; padding: 12px; border-radius: 12px; font-size: 1rem;
      background: var(--vo-bg-input); color: var(--vo-text-primary); border: 1px solid var(--vo-border);
    }
    .al-field option, .al-field optgroup { background: var(--vo-bg-secondary); color: var(--vo-text-primary); }
    .al-row {
      width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; text-align: left;
      background: var(--vo-bg-input); border: 1px solid var(--vo-border); border-radius: 12px; padding: 12px; color: inherit; cursor: pointer;
    }
    .al-row small { display: block; color: var(--vo-text-muted); font-size: .78rem; margin-top: 2px; }
    .al-toggle { width: 44px; height: 26px; border-radius: 13px; background: var(--vo-border-light); position: relative; flex: none; transition: background .2s; }
    .al-toggle span { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .2s; }
    .al-toggle.on { background: var(--vo-accent); }
    .al-toggle.on span { transform: translateX(18px); }
    .al-note { font-size: .8rem; color: var(--vo-text-muted); line-height: 1.45; margin: 12px 0; }
    .al-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .al-actions .vo-btn { flex: 1 1 auto; justify-content: center; }
    .al-next { text-align: center; margin: 12px 0 0; color: var(--vo-accent-light); font-size: .85rem; }

    .al-night {
      position: fixed; inset: 0; z-index: 4002; background: #000; color: #e8e6ff;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
      padding: env(safe-area-inset-top, 0) 16px env(safe-area-inset-bottom, 0); text-align: center;
      transition: opacity .4s; cursor: pointer; user-select: none;
    }
    .al-night.dim { opacity: .35; }
    .al-night__time { font: 200 clamp(64px, 24vw, 180px)/1 var(--vo-font-display); letter-spacing: -2px; }
    .al-night__date { font-size: 1rem; opacity: .7; }
    .al-night__alarm { margin-top: 8px; font-size: 1.05rem; color: var(--vo-accent-light); }
    .al-night__alarm.muted { color: #777; }
    .al-night__playing { font-size: .85rem; opacity: .6; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .al-night__actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 18px; }
    .al-night__actions button {
      background: rgba(255,255,255,.08); color: #ddd; border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px; padding: 10px 16px; font-size: .9rem; cursor: pointer;
    }
    .al-night__hint { position: absolute; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); font-size: .72rem; opacity: .4; margin: 0; }

    .al-ring {
      position: fixed; inset: 0; z-index: 4003; overflow: hidden;
      background: linear-gradient(180deg, #1b1446 0%, #6c3a8e 55%, #f7a35c 100%);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
      padding: env(safe-area-inset-top, 0) 20px env(safe-area-inset-bottom, 0); text-align: center; color: #fff;
    }
    .al-ring__sun {
      position: absolute; bottom: -120px; width: 320px; height: 320px; border-radius: 50%;
      background: radial-gradient(circle, #ffd27a 0%, rgba(255,180,90,.5) 45%, transparent 70%);
      animation: al-rise 4s ease-in-out infinite alternate;
    }
    @keyframes al-rise { to { transform: translateY(-30px) scale(1.08); } }
    .al-ring__time { font: 300 clamp(64px, 22vw, 150px)/1 var(--vo-font-display); position: relative; }
    .al-ring h2 { font-size: 1.4rem; margin: 0; position: relative; }
    .al-ring__playing { opacity: .85; position: relative; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .al-ring__actions { display: flex; gap: 16px; margin-top: 24px; position: relative; }
    .al-ring__actions .big {
      width: 128px; height: 128px; border-radius: 50%; border: 0; cursor: pointer;
      background: rgba(255,255,255,.18); color: #fff; font-size: .95rem; font-weight: 600;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      backdrop-filter: blur(8px);
    }
    .al-ring__actions .big i { font-size: 2rem; }
    .al-ring__actions .big.stop { background: #fff; color: #3a2270; }
    .al-ring__keep { position: relative; margin-top: 12px; background: none; border: 0; color: #fff; text-decoration: underline; opacity: .85; cursor: pointer; font-size: .95rem; padding: 10px; }
  `],
})
export class AlarmComponent {
  readonly alarms = inject(AlarmService);
  readonly player = inject(PlayerService);
  private wake = inject(WakeLockService);

  readonly dayLetters = DAY_LETTERS;
  readonly dayNames = DAY_NAMES;
  readonly radioCats = MUSIC_CATEGORIES.filter((c) => c.group === 'radio');
  readonly songCats = MUSIC_CATEGORIES.filter((c) => c.group === 'language' || c.group === 'mood');

  readonly time = signal('06:30');
  readonly days = signal<number[]>([1, 2, 3, 4, 5]);
  readonly sourceKey = signal('cat:radio-himalayan');
  readonly gentle = signal(true);
  readonly dim = signal(false);

  readonly current = computed(() => this.player.currentTrack());
  readonly savedTrack = computed(() => {
    const s = this.alarms.alarm()?.source;
    return s?.kind === 'track' && s.track.id !== this.current()?.id ? s.track : null;
  });
  readonly nowDate = computed(() => new Date(this.alarms.now()));
  readonly isWeekdays = computed(() => this.days().join() === '1,2,3,4,5');

  constructor() {
    const back = inject(BackService);
    back.bind(this.alarms.sheetOpen, () => this.alarms.sheetOpen.set(false));
    back.bind(this.alarms.nightClock, () => this.alarms.nightClock.set(false));

    // Open the sheet with the saved alarm filled in
    effect(() => {
      if (!this.alarms.sheetOpen()) return;
      untracked(() => {
        const a = this.alarms.alarm();
        if (!a) return;
        this.time.set(a.time);
        this.days.set([...a.days]);
        this.gentle.set(a.gentle);
        const s = a.source;
        this.sourceKey.set(s.kind === 'category' ? `cat:${s.id}` : s.kind === 'track' ? 'saved-track' : s.kind);
      });
    });

    // Screen stays on while the night clock is up
    effect(() => {
      if (this.alarms.nightClock()) this.wake.acquire('night');
      else this.wake.release('night');
    });
  }

  toggleDay(d: number): void {
    this.days.update((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  }

  private source(): AlarmSource {
    const k = this.sourceKey();
    const saved = this.alarms.alarm()?.source;
    if (k === 'current' && this.current()) return { kind: 'track', track: this.current()! };
    if (k === 'saved-track' && saved?.kind === 'track') return saved;
    if (k === 'liked' || k === 'mysongs') return { kind: k };
    if (k.startsWith('cat:')) return { kind: 'category', id: k.slice(4) };
    return { kind: 'category', id: 'radio-himalayan' };
  }

  save(): void {
    this.alarms.save({ time: this.time(), days: this.days(), source: this.source(), gentle: this.gentle() });
    this.alarms.sheetOpen.set(false);
    window.dispatchEvent(new CustomEvent('vo-notice', { detail: `⏰ Alarm set for ${this.time()} — in ${this.alarms.countdown()}` }));
  }

  startNight(): void {
    this.save();
    this.alarms.nightClock.set(true);
  }

  test(): void {
    this.alarms.save({ time: this.time(), days: this.days(), source: this.source(), gentle: this.gentle() });
    this.alarms.sheetOpen.set(false);
    this.alarms.test();
  }

  sleep(): void {
    this.player.setSleepTimer(30);
  }

  clock(d: Date): string {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  longDate(d: Date): string {
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  dayLabel(d: Date): string {
    const today = new Date(this.alarms.now());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'today';
    if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow';
    return `on ${DAY_NAMES[d.getDay()]}`;
  }
}
