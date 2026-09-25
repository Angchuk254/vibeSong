// ============================================
// YakBeats — YouTube video window
// ============================================
// Hosts the official YouTube player. YouTube requires the player to stay
// visible (at least 200px) while it plays, so it sits in the album-art spot of
// the full-screen player, or floats above the mini player when collapsed.
// The iframe is never moved in the DOM (that would restart it) — only
// repositioned with fixed coordinates.

import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject } from '@angular/core';
import { PlayerService, YouTubeService, DeviceMusicService } from '../../services';

@Component({
  selector: 'app-video-dock',
  standalone: true,
  template: `
    <div class="dock" #dock
         [class.dock--visible]="visible()"
         [class.dock--docked]="visible() && !player.playerExpanded()"
         [class.dock--expanded]="visible() && player.playerExpanded()">
      @if (visible() && !player.playerExpanded()) {
        <div class="dock__bar">
          <span class="dock__label"><i class="bi bi-youtube"></i> {{ player.currentTrack()?.name }}</span>
          <button (click)="player.playerExpanded.set(true)" aria-label="Open player"><i class="bi bi-arrows-angle-expand"></i></button>
        </div>
      }
      <div class="dock__video" #host></div>
    </div>
  `,
  styles: [`
    .dock {
      position: fixed;
      z-index: 1040;
      /* Parked off-screen until a YouTube song plays */
      left: -9999px;
      top: 0;
      width: 320px;
      height: 200px;
      border-radius: var(--vo-radius-md);
      overflow: hidden;
      background: #000;
      display: flex;
      flex-direction: column;
    }

    .dock--docked {
      left: auto;
      top: auto;
      right: 12px;
      bottom: calc(var(--vo-bottom-nav-height) + var(--vo-player-height) + env(safe-area-inset-bottom, 0px) + 12px);
      width: min(356px, calc(100vw - 24px));
      height: auto;
      box-shadow: var(--vo-shadow-lg);
      border: 1px solid var(--vo-border-light);
      animation: dockIn 0.25s ease;

      .dock__video { height: 200px; }
    }

    .dock--expanded {
      z-index: 2100;
      border-radius: var(--vo-radius-lg);
      box-shadow: var(--vo-shadow-lg);
    }

    .dock__video {
      flex: 1;
      min-height: 200px;

      ::ng-deep iframe { width: 100%; height: 100%; display: block; }
    }

    .dock__bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px 6px 12px;
      background: var(--vo-bg-card);
      color: var(--vo-text-primary);
      font-size: 0.78rem;

      button {
        background: none;
        border: none;
        color: var(--vo-text-secondary);
        cursor: pointer;
        padding: 4px 6px;
      }
    }

    .dock__label {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      i { color: #ff3d3d; margin-right: 4px; }
    }

    @media (min-width: 769px) {
      .dock--docked {
        bottom: calc(var(--vo-player-height) + 12px);
      }
    }

    @keyframes dockIn {
      from { opacity: 0; transform: translateY(12px); }
    }
  `],
})
export class VideoDockComponent implements AfterViewInit, OnDestroy {
  readonly player = inject(PlayerService);
  private youtube = inject(YouTubeService);
  private device = inject(DeviceMusicService);
  @ViewChild('host', { static: true }) host!: ElementRef<HTMLElement>;
  @ViewChild('dock', { static: true }) dock!: ElementRef<HTMLElement>;

  readonly visible = computed(() => this.player.mode() === 'youtube' && !!this.player.currentTrack());
  private raf = 0;

  constructor() {
    // While the full-screen player is open, follow its video slot
    effect(() => {
      const follow = this.visible() && this.player.playerExpanded();
      cancelAnimationFrame(this.raf);
      if (follow) this.follow();
      else this.clearPosition();
    });
  }

  ngAfterViewInit(): void {
    this.player.setVideoHost(this.host.nativeElement);
    // Mobile browsers only start a video right after a tap, so have the
    // player ready before the first tap if YouTube songs are likely
    this.device.ready.then(() => {
      const likely = this.youtube.hasKey() || this.device.tracks().some((t) => t.provider === 'youtube')
        || this.player.queue().some((t) => t.provider === 'youtube');
      if (likely) setTimeout(() => this.player.prepareYouTube(), 1500);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.player.setVideoHost(null);
  }

  private follow(): void {
    const el = this.dock.nativeElement;
    const slot = document.querySelector('.player__video-slot') as HTMLElement | null;
    if (slot) {
      const r = slot.getBoundingClientRect();
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${Math.max(200, r.height)}px`;
    }
    this.raf = requestAnimationFrame(() => this.follow());
  }

  private clearPosition(): void {
    const el = this.dock?.nativeElement;
    if (!el) return;
    el.style.left = el.style.top = el.style.width = el.style.height = '';
  }
}
