// ============================================
// vibeOnly — Global error handler
// ============================================
// Keeps one unexpected error from leaving a blank or frozen screen: it's
// logged, and the user sees a short message instead.

import { ErrorHandler, Injectable } from '@angular/core';
import { notify } from '../services/storage.service';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private lastShown = 0;

  handleError(error: unknown): void {
    console.error('[vibeOnly] Unexpected error:', error);
    const msg = String((error as Error)?.message || error);
    // A new version was deployed and an old lazy chunk is gone: reload once
    if (/Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
      if (!sessionStorage.getItem('vo_chunk_reload')) {
        sessionStorage.setItem('vo_chunk_reload', '1');
        location.reload();
        return;
      }
    }
    if (Date.now() - this.lastShown > 10000) {
      this.lastShown = Date.now();
      notify('Something went wrong — if a page looks stuck, pull to refresh.');
    }
  }
}
