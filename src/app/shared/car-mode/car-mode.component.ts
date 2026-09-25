// ============================================
// YakBeats — Car mode: huge buttons, swipe to skip, screen stays on
// ============================================

import { Component, computed, effect, inject, signal } from '@angular/core';
import { AlarmService, AlarmSource } from '../../services/alarm.service';
import { PlayerService } from '../../services/player.service';
import { BackService } from '../../services/back.service';
import { WakeLockService } from '../../services/wake-lock.service';

@Component({
  selector: 'app-car-mode',
  standalone: true,
  template: `
    @if (alarms.carMode()) {
      <div class="car" role="dialog" aria-label="Car mode"
           (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">
        <header class="car__top">
          <span class="car__clock">{{ clock() }}</span>
          <span class="car__label"><i class="bi bi-car-front-fill"></i> Car mode</span>
          <button class="car__exit" (click)="alarms.carMode.set(false)" aria-label="Exit car mode"><i class="bi bi-x-lg"></i></button>
        </header>

        @if (player.currentTrack(); as t) {
          <div class="car__now">
            <img class="car__art" [src]="t.album_image || t.image || 'icons/icon-192x192.png'" alt="" />
            <div class="car__info">
              <h1 class="car__title">{{ t.name }}</h1>
              <p class="car__artist">{{ t.artist_name }}</p>
              @if (player.isLive()) {
                <span class="car__live">● LIVE RADIO</span>
              } @else {
                <div class="car__bar"><div [style.width.%]="player.progress()"></div></div>
              }
            </div>
          </div>

          <div class="car__controls">
            <button class="car__btn" (click)="player.playPrevious()" aria-label="Previous"><i class="bi bi-skip-start-fill"></i></button>
            <button class="car__btn car__btn--play" (click)="player.togglePlay()" aria-label="Play or pause">
              @if (player.isLoading()) {
                <i class="bi bi-arrow-repeat car__spin"></i>
              } @else {
                <i class="bi" [class.bi-pause-fill]="player.isPlaying()" [class.bi-play-fill]="!player.isPlaying()"></i>
              }
            </button>
            <button class="car__btn" (click)="player.playNext()" aria-label="Next"><i class="bi bi-skip-end-fill"></i></button>
          </div>
          <p class="car__hint">Swipe left or right anywhere to skip</p>
        } @else {
          <div class="car__empty">
            <i class="bi bi-music-note-beamed"></i>
            <p>Pick something to play</p>
          </div>
        }

        @if (player.notice()) {
          <div class="car__toast" role="status">{{ player.notice() }}</div>
        }

        <nav class="car__quick">
          @if (player.currentTrack(); as t) {
            <button (click)="player.toggleFavorite(t)" [class.on]="player.isFavorite(t.id)">
              <i class="bi" [class.bi-heart-fill]="player.isFavorite(t.id)" [class.bi-heart]="!player.isFavorite(t.id)"></i><span>Like</span>
            </button>
          }
          <button (click)="start({ kind: 'category', id: 'radio-himalayan' })"><i class="bi bi-broadcast"></i><span>Himalayan radio</span></button>
          <button (click)="start({ kind: 'category', id: 'radio-pahadi' })"><i class="bi bi-tree-fill"></i><span>Pahadi radio</span></button>
          <button (click)="start({ kind: 'liked' })"><i class="bi bi-heart-fill"></i><span>Liked</span></button>
          <button (click)="start({ kind: 'mysongs' })"><i class="bi bi-phone"></i><span>My Songs</span></button>
        </nav>
      </div>
    }
  `,
  styles: [`
    :host { position: relative; z-index: 3900; }
    .car {
      position: fixed; inset: 0; z-index: 3900; background: #05050d; color: #fff;
      display: flex; flex-direction: column; gap: 14px;
      padding: calc(12px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px))
               calc(14px + env(safe-area-inset-bottom, 0px)) calc(16px + env(safe-area-inset-left, 0px));
      user-select: none; touch-action: pan-y;
    }
    .car__top { display: flex; align-items: center; gap: 12px; }
    .car__clock { font: 600 1.6rem var(--vo-font-display); }
    .car__label { flex: 1; color: var(--vo-accent-light); font-size: .9rem; }
    .car__exit {
      width: 52px; height: 52px; border-radius: 50%; border: 0; cursor: pointer;
      background: rgba(255,255,255,.1); color: #fff; font-size: 1.3rem;
    }
    .car__now { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
    .car__art { width: min(44vw, 30vh); aspect-ratio: 1; object-fit: cover; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.6); }
    .car__info { width: 100%; min-width: 0; }
    .car__title {
      font: 800 clamp(1.6rem, 7vw, 2.6rem)/1.15 var(--vo-font-display); margin: 0;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .car__artist { font-size: clamp(1rem, 4.5vw, 1.4rem); color: rgba(255,255,255,.65); margin: 8px 0 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .car__live { color: #ff5c7a; font-weight: 700; letter-spacing: .08em; font-size: .9rem; }
    .car__bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); overflow: hidden; }
    .car__bar div { height: 100%; background: var(--vo-accent-light); transition: width .3s linear; }
    .car__controls { display: flex; align-items: center; justify-content: space-evenly; }
    .car__btn {
      width: 88px; height: 88px; border-radius: 50%; border: 0; cursor: pointer;
      background: rgba(255,255,255,.1); color: #fff; font-size: 2.4rem;
      display: flex; align-items: center; justify-content: center;
    }
    .car__btn:active { transform: scale(.94); }
    .car__btn--play { width: 116px; height: 116px; font-size: 3.4rem; background: var(--vo-accent); box-shadow: 0 0 40px var(--vo-accent-glow); }
    .car__spin { animation: car-spin 1s linear infinite; }
    @keyframes car-spin { to { transform: rotate(360deg); } }
    .car__hint { text-align: center; font-size: .75rem; color: rgba(255,255,255,.35); margin: 0; }
    .car__empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: rgba(255,255,255,.5); }
    .car__empty i { font-size: 3rem; }
    .car__toast {
      position: absolute; left: 16px; right: 16px; top: calc(76px + env(safe-area-inset-top, 0px)); z-index: 1;
      background: #fff; color: #111; border-radius: 14px; padding: 12px 16px; text-align: center; font-weight: 600;
    }
    .car__quick { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; }
    .car__quick button {
      min-height: 72px; border-radius: 16px; border: 0; cursor: pointer; padding: 8px 4px;
      background: rgba(255,255,255,.08); color: #fff; font-size: .78rem;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    }
    .car__quick button i { font-size: 1.5rem; }
    .car__quick button.on i { color: #ff5c7a; }
    .car__quick button span { line-height: 1.15; }

    @media (orientation: landscape) and (max-height: 560px) {
      .car { gap: 8px; }
      .car__now { flex-direction: row; text-align: left; }
      .car__art { width: 34vh; }
      .car__btn { width: 72px; height: 72px; font-size: 2rem; }
      .car__btn--play { width: 92px; height: 92px; font-size: 2.8rem; }
      .car__quick button { min-height: 56px; }
      .car__hint { display: none; }
    }
  `],
})
export class CarModeComponent {
  readonly alarms = inject(AlarmService);
  readonly player = inject(PlayerService);
  private wake = inject(WakeLockService);
  private startX = 0;
  private startY = 0;
  private busy = signal(false);

  readonly clock = computed(() => {
    const d = new Date(this.alarms.now());
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  constructor() {
    inject(BackService).bind(this.alarms.carMode, () => this.alarms.carMode.set(false));
    effect(() => {
      if (this.alarms.carMode()) this.wake.acquire('car');
      else this.wake.release('car');
    });
  }

  async start(source: AlarmSource): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const ok = await this.alarms.play(source);
    this.busy.set(false);
    if (!ok) {
      const msg = source.kind === 'mysongs' ? 'No songs in My Songs yet' : source.kind === 'liked' ? 'No liked songs yet' : 'No stations found — check your connection';
      window.dispatchEvent(new CustomEvent('vo-notice', { detail: msg }));
    }
  }

  touchStart(e: TouchEvent): void {
    this.startX = e.changedTouches[0].clientX;
    this.startY = e.changedTouches[0].clientY;
  }

  touchEnd(e: TouchEvent): void {
    const dx = e.changedTouches[0].clientX - this.startX;
    const dy = e.changedTouches[0].clientY - this.startY;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) this.player.playNext();
    else this.player.playPrevious();
  }
}
