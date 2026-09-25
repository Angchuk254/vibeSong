// ============================================
// YakBeats — Keep the screen on (car mode, night clock, alarm)
// ============================================

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WakeLockService {
  readonly supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  private holders = new Set<string>();
  private lock: { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void } | null = null;
  private pending = false;

  constructor() {
    // The browser drops the lock whenever the app is hidden; take it back on return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.sync();
    });
  }

  acquire(who: string): void {
    this.holders.add(who);
    this.sync();
  }

  release(who: string): void {
    this.holders.delete(who);
    this.sync();
  }

  private async sync(): Promise<void> {
    if (!this.supported || this.pending) return;
    if (this.holders.size && !this.lock && document.visibilityState === 'visible') {
      this.pending = true;
      try {
        this.lock = await (navigator as any).wakeLock.request('screen');
        this.lock!.addEventListener('release', () => (this.lock = null));
      } catch {
        /* battery saver or not allowed */
      } finally {
        this.pending = false;
      }
      if (!this.holders.size) this.sync(); // released while we were asking
    } else if (!this.holders.size && this.lock) {
      const l = this.lock;
      this.lock = null;
      l.release().catch(() => undefined);
    }
  }
}
