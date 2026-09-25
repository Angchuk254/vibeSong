// ============================================
// YakBeats — App updates (service worker)
// ============================================
// The app works offline through a service worker, which means an old version
// can linger after a new deploy. This checks for updates regularly and lets
// the user switch to the new version with one tap.

import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private sw = inject(SwUpdate);
  readonly updateReady = signal(false);

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.subscribe((e) => {
      if (e.type === 'VERSION_READY') this.updateReady.set(true);
    });
    // The cached app is broken beyond repair: load a fresh copy
    this.sw.unrecoverable.subscribe(() => location.reload());

    const check = () => this.sw.checkForUpdate().catch(() => undefined);
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  }

  async applyUpdate(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } finally {
      location.reload();
    }
  }
}
