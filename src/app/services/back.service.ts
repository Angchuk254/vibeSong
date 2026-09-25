// ============================================
// YakBeats — Phone back button
// ============================================
// Makes the Android back button / back gesture behave like a native app:
// it closes whatever is open on top (full-screen player, sheets, menus)
// before leaving the page. Each open overlay adds one history entry;
// the back button pops it and we close the overlay. Closing it from the UI
// removes the entry quietly so history doesn't fill up with dead steps.

import { Injectable, Signal, effect, inject, Injector, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationStart, Router } from '@angular/router';

interface Entry {
  id: number;
  close: () => void;
  /** Left behind by an in-app navigation: close without touching history */
  abandoned?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BackService {
  private router = inject(Router);
  private location = inject(Location);
  private stack: Entry[] = [];
  private nextId = 1;
  /** A history.back() we triggered ourselves — don't treat it as the user's */
  private ignorePops = 0;

  constructor() {
    // Navigating inside the app while something is open: the overlay closes,
    // but its history step must not be popped (that would undo the navigation)
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart && e.navigationTrigger === 'imperative') {
        this.stack.forEach((entry) => (entry.abandoned = true));
        this.stack = [];
      }
    });

    window.addEventListener('popstate', () => {
      if (this.ignorePops > 0) {
        this.ignorePops--;
        return;
      }
      const top = this.stack.pop();
      if (top) top.close();
    });
  }

  /**
   * Tie an overlay's open/closed signal to the back button. Call from a
   * component constructor (or pass an injector).
   */
  bind(isOpen: Signal<boolean>, close: () => void, injector?: Injector): void {
    let entry: Entry | null = null;
    effect(
      () => {
        const open = isOpen();
        untracked(() => {
          if (open && !entry) {
            entry = { id: this.nextId++, close: () => { entry = null; close(); } };
            this.stack.push(entry);
            history.pushState({ ...(history.state || {}), voOverlay: entry.id }, '');
          } else if (!open && entry) {
            // Closed from the UI: drop our history step without closing anything else
            const i = this.stack.indexOf(entry);
            if (i >= 0) this.stack.splice(i, 1);
            const abandoned = entry.abandoned;
            entry = null;
            if (!abandoned && history.state?.voOverlay) {
              this.ignorePops++;
              history.back();
            }
          }
        });
      },
      injector ? { injector } : undefined
    );
  }

  /**
   * Navigate from inside an overlay (e.g. "Go to artist" in a menu): the
   * overlay's history step is reused for the new page, so one back press
   * returns to where you were.
   */
  navigate(commands: unknown[]): void {
    const replaceUrl = !!history.state?.voOverlay;
    this.router.navigate(commands, { replaceUrl });
  }

  /**
   * In-app ‹ back buttons: go back if there's somewhere in the app to go,
   * otherwise (opened straight onto this page) go Home.
   */
  goBack(): void {
    const navId = (history.state as { navigationId?: number } | null)?.navigationId ?? 1;
    if (navId > 1) this.location.back();
    else this.router.navigate(['/'], { replaceUrl: true });
  }
}
