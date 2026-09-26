// ============================================
// YakBeats — Home-screen shortcuts
// ============================================
// Long-press the installed app icon → Himalayan Radio, Liked Songs, Car mode,
// My Songs or Search. Each opens the app with ?shortcut=… (see
// manifest.webmanifest) and we act on it once the app has started.

import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AlarmService, AlarmSource } from './alarm.service';
import { PlayerService } from './player.service';

export type ShortcutKey = 'radio' | 'liked' | 'car' | 'mysongs' | 'search';

@Injectable({ providedIn: 'root' })
export class ShortcutService {
  private router = inject(Router);
  private alarms = inject(AlarmService);
  private player = inject(PlayerService);

  /** Call once at start-up */
  init(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), take(1))
      .subscribe(() => {
        const key = new URLSearchParams(location.search).get('shortcut') as ShortcutKey | null;
        if (key) this.run(key);
      });
  }

  async run(key: ShortcutKey): Promise<void> {
    switch (key) {
      case 'radio':
        this.clearParam();
        return this.start({ kind: 'category', id: 'radio-himalayan' }, 'No stations found — check your connection');
      case 'liked':
        this.router.navigate(['/library'], { queryParams: { tab: 'liked' }, replaceUrl: true });
        return this.start({ kind: 'liked' }, 'No liked songs yet — tap ♥ on songs you love');
      case 'mysongs':
        this.router.navigate(['/library'], { queryParams: { tab: 'device' }, replaceUrl: true });
        return this.start({ kind: 'mysongs' }, 'No songs in My Songs yet — add some here');
      case 'car':
        this.clearParam();
        this.alarms.carMode.set(true);
        return;
      case 'search':
        await this.router.navigate(['/search'], { replaceUrl: true });
        setTimeout(() => (document.querySelector('.search-input') as HTMLInputElement | null)?.focus(), 300);
        return;
    }
  }

  private async start(source: AlarmSource, emptyMsg: string): Promise<void> {
    const ok = await this.alarms.play(source).catch(() => false);
    if (!ok) return this.notice(emptyMsg);
    // Some phones block sound until the first tap: say so instead of sitting silent
    setTimeout(() => {
      if (this.player.currentTrack() && !this.player.isPlaying() && !this.player.isLoading()) this.notice('Tap ▶ to start playing');
    }, 4000);
  }

  private clearParam(): void {
    this.router.navigate([], { queryParams: { shortcut: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private notice(msg: string): void {
    window.dispatchEvent(new CustomEvent('vo-notice', { detail: msg }));
  }
}
