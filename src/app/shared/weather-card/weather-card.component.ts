// ============================================
// YakBeats — Home weather mood card
// ============================================

import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { WeatherService, placeMinutes } from '../../services/weather.service';
import { AlarmService } from '../../services/alarm.service';
import { LocationService } from '../../services/location.service';

@Component({
  selector: 'app-weather-card',
  standalone: true,
  template: `
    @if (location.enabled() && weather.weather(); as w) {
      @if (weather.mood(); as m) {
        <section class="wx" [attr.data-scene]="m.scene" aria-label="Weather and music mood">
          <div class="wx__fx" aria-hidden="true">
            @if (m.scene === 'rain' || m.scene === 'storm' || m.scene === 'snow') {
              @for (p of particles; track $index) {
                <span class="wx__p" [style.left.%]="p.left" [style.animation-delay.s]="p.delay" [style.animation-duration.s]="p.dur"></span>
              }
            }
            @if (m.scene === 'night') {
              @for (p of particles; track $index) {
                <span class="wx__star" [style.left.%]="p.left" [style.top.%]="p.top" [style.animation-delay.s]="p.delay"></span>
              }
            }
          </div>

          <div class="wx__top">
            <i class="bi wx__icon {{ m.icon }}"></i>
            <div class="wx__temp">{{ round(w.temp) }}°</div>
            <div class="wx__cond">
              <strong>{{ m.label }}</strong>
              <span>Feels like {{ round(w.feels) }}°</span>
            </div>
            <button class="wx__live" (click)="refresh()" [attr.aria-label]="'Weather updated ' + weather.updatedAgo() + ', tap to refresh'">
              <span class="wx__dot" [class.busy]="weather.loading()"></span> Live
            </button>
          </div>

          <h3 class="wx__headline">{{ m.headline }}</h3>
          <p class="wx__line">{{ m.line }}</p>

          <div class="wx__chips">
            @if (w.max != null && w.min != null) {
              <span aria-label="Today's high and low"><i class="bi bi-thermometer-half"></i> {{ round(w.max) }}° / {{ round(w.min) }}°</span>
            }
            <span><i class="bi bi-wind"></i> {{ round(w.wind) }} km/h</span>
            <span><i class="bi bi-droplet-half"></i> {{ w.humidity }}%</span>
            @if (sunEvent(); as s) { <span><i class="bi {{ s.icon }}"></i> {{ s.label }}</span> }
          </div>

          <div class="wx__actions">
            <button class="wx__play" (click)="play(m.categoryId)" [disabled]="busy()">
              <i class="bi" [class.bi-play-fill]="!busy()" [class.bi-hourglass-split]="busy()"></i> Play {{ m.playLabel }}
            </button>
            <button class="wx__more" (click)="open(m.categoryId)" aria-label="Open this playlist"><i class="bi bi-chevron-right"></i></button>
            <span class="wx__updated">Updated {{ weather.updatedAgo() }}</span>
          </div>
        </section>
      }
    }
  `,
  styles: [`
    .wx {
      position: relative; overflow: hidden; isolation: isolate;
      max-width: 620px; margin-top: 12px; padding: 16px;
      border-radius: var(--vo-radius-lg); color: #fff;
      background: linear-gradient(135deg, #616d7e, #3a4556);
      box-shadow: var(--vo-shadow-md);
    }
    .wx[data-scene='sun'] { background: linear-gradient(135deg, #f7971e 0%, #f45c43 100%); }
    .wx[data-scene='night'] { background: linear-gradient(135deg, #0f2027, #203a43 55%, #2c5364); }
    .wx[data-scene='clouds'] { background: linear-gradient(135deg, #5f6f86, #36404f); }
    .wx[data-scene='fog'] { background: linear-gradient(135deg, #8a93a8, #4b5468); }
    .wx[data-scene='rain'] { background: linear-gradient(135deg, #2b5876, #4e4376); }
    .wx[data-scene='snow'] { background: linear-gradient(135deg, #4a6fa5, #7f9ccf); }
    .wx[data-scene='storm'] { background: linear-gradient(135deg, #1f1c2c, #414345); }

    /* Scenery */
    .wx__fx { position: absolute; inset: 0; z-index: -1; pointer-events: none; }
    .wx[data-scene='sun'] .wx__fx::before {
      content: ''; position: absolute; width: 180px; height: 180px; right: -50px; top: -60px; border-radius: 50%;
      background: radial-gradient(circle, rgba(255,241,170,.95) 0%, rgba(255,210,120,.45) 40%, transparent 70%);
      animation: wx-glow 6s ease-in-out infinite alternate;
    }
    .wx[data-scene='clouds'] .wx__fx::before, .wx[data-scene='fog'] .wx__fx::before {
      content: ''; position: absolute; left: -30%; right: -30%; top: 10%; height: 70%;
      background: radial-gradient(ellipse at 30% 50%, rgba(255,255,255,.18), transparent 60%),
                  radial-gradient(ellipse at 75% 40%, rgba(255,255,255,.14), transparent 55%);
      animation: wx-drift 18s linear infinite alternate;
    }
    .wx[data-scene='storm'] .wx__fx::after {
      content: ''; position: absolute; inset: 0; background: rgba(255,255,255,.55); opacity: 0;
      animation: wx-flash 7s infinite;
    }
    .wx__p { position: absolute; top: -20px; display: block; }
    .wx[data-scene='rain'] .wx__p, .wx[data-scene='storm'] .wx__p {
      width: 2px; height: 16px; border-radius: 1px; background: rgba(255,255,255,.45);
      animation: wx-rain linear infinite;
    }
    .wx[data-scene='snow'] .wx__p {
      width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.9);
      animation: wx-snow linear infinite;
    }
    .wx__star {
      position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff;
      animation: wx-twinkle 3s ease-in-out infinite;
    }
    @keyframes wx-rain { to { transform: translate(-30px, 320px); } }
    @keyframes wx-snow { 50% { transform: translate(12px, 160px); } to { transform: translate(-8px, 320px); } }
    @keyframes wx-twinkle { 50% { opacity: .2; } }
    @keyframes wx-glow { to { transform: scale(1.12); } }
    @keyframes wx-drift { to { transform: translateX(12%); } }
    @keyframes wx-flash { 0%, 90%, 94%, 100% { opacity: 0; } 91%, 93% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .wx *, .wx__fx::before, .wx__fx::after { animation: none !important; }
      .wx__p { display: none; }
    }

    .wx__top { display: flex; align-items: center; gap: 12px; }
    .wx__icon { font-size: 2.4rem; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,.25)); }
    .wx__temp { font: 700 2.6rem/1 var(--vo-font-display); letter-spacing: -1px; }
    .wx__cond { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .wx__cond strong { font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wx__cond span { font-size: .8rem; opacity: .85; }
    .wx__live {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; flex: none;
      background: rgba(0,0,0,.22); color: #fff; border: 0; border-radius: 999px;
      padding: 4px 10px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; cursor: pointer;
    }
    .wx__dot { width: 7px; height: 7px; border-radius: 50%; background: #5dffa0; box-shadow: 0 0 0 0 rgba(93,255,160,.7); animation: wx-pulse 2s infinite; }
    .wx__dot.busy { background: #ffd35d; }
    @keyframes wx-pulse { 70% { box-shadow: 0 0 0 6px rgba(93,255,160,0); } 100% { box-shadow: 0 0 0 0 rgba(93,255,160,0); } }

    .wx__headline { margin: 14px 0 4px; font: 700 1.15rem/1.3 var(--vo-font-display); }
    .wx__line { margin: 0; font-size: .9rem; opacity: .92; line-height: 1.45; }
    .wx__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .wx__chips span {
      display: inline-flex; align-items: center; gap: 5px; font-size: .75rem;
      background: rgba(255,255,255,.16); border-radius: 999px; padding: 4px 10px;
    }
    .wx__actions { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .wx__play {
      display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer;
      background: #fff; color: #1d1b3a; font-weight: 700; font-size: .88rem;
      border-radius: 999px; padding: 9px 16px; max-width: 100%;
    }
    .wx__play:disabled { opacity: .7; }
    .wx__more {
      width: 38px; height: 38px; border-radius: 50%; border: 0; cursor: pointer;
      background: rgba(255,255,255,.2); color: #fff;
    }
    .wx__updated { margin-left: auto; font-size: .72rem; opacity: .75; }
  `],
})
export class WeatherCardComponent {
  readonly weather = inject(WeatherService);
  readonly location = inject(LocationService);
  private alarms = inject(AlarmService);
  private router = inject(Router);
  readonly busy = signal(false);

  /** Positions for rain drops / snowflakes / stars (fixed, so they don't jump) */
  readonly particles = Array.from({ length: 18 }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53) % 90,
    delay: -((i * 0.37) % 3),
    dur: 0.8 + ((i * 7) % 5) * 0.15,
  }));

  /** Next sunrise or sunset, e.g. "Sunset 6:12 pm" */
  readonly sunEvent = computed(() => {
    const w = this.weather.weather();
    this.weather.tick();
    if (!w?.sunrise || !w.sunset) return null;
    // Open-Meteo gives local times at the place; compare as local wall-clock
    const hm = (iso: string) => iso.slice(11, 16);
    const m = placeMinutes(w);
    const nowPlace = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const rise = hm(w.sunrise);
    const set = hm(w.sunset);
    const fmt = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
    };
    if (nowPlace < rise) return { icon: 'bi-sunrise', label: `Sunrise ${fmt(rise)}` };
    if (nowPlace < set) return { icon: 'bi-sunset', label: `Sunset ${fmt(set)}` };
    return { icon: 'bi-sunrise', label: `Sunrise ${fmt(rise)}` };
  });

  round(n: number): number {
    const r = Math.round(n);
    return r === 0 ? 0 : r; // no "-0"
  }

  refresh(): void {
    this.weather.refresh(true);
  }

  async play(categoryId: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const ok = await this.alarms.play({ kind: 'category', id: categoryId }).catch(() => false);
    this.busy.set(false);
    if (!ok) window.dispatchEvent(new CustomEvent('vo-notice', { detail: 'Couldn’t load that mood right now — check your connection' }));
  }

  open(categoryId: string): void {
    this.router.navigate(['/category', categoryId]);
  }
}
