// ============================================
// vibeOnly — Music Player Component
// ============================================

import { Component, inject, signal } from '@angular/core';
import { PlayerService, StorageService } from '../services';
import { TrackListItemComponent } from '../shared/track-list-item/track-list-item.component';
import { Track } from '../models';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [TrackListItemComponent],
  template: `
    @if (player.isPlayerVisible() && player.currentTrack()) {
      <div class="player" [class.player--expanded]="isExpanded()">
        <!-- Mini Player (default) -->
        <div class="player__mini" (click)="toggleExpand()">
          <div class="player__progress-bar-mini">
            <div class="player__progress-fill-mini"
                 [style.width.%]="player.progress()">
            </div>
          </div>

          <div class="player__mini-content">
            <img class="player__mini-img"
                 [src]="player.currentTrack()!.album_image || player.currentTrack()!.image || 'icons/icon-192x192.png'"
                 [alt]="player.currentTrack()!.name" />
            <div class="player__mini-info">
              <p class="player__mini-title">{{ player.currentTrack()!.name }}</p>
              <p class="player__mini-artist">{{ player.currentTrack()!.artist_name }}</p>
            </div>
            <div class="player__mini-controls" (click)="$event.stopPropagation()">
              <button class="player__ctrl-btn" (click)="player.playPrevious()" aria-label="Previous">
                <i class="bi bi-skip-start-fill"></i>
              </button>
              <button class="player__ctrl-btn player__ctrl-btn--play" (click)="player.togglePlay()" aria-label="Play/Pause">
                @if (player.isLoading()) {
                  <i class="bi bi-arrow-repeat player__spin"></i>
                } @else {
                  <i class="bi" [class.bi-pause-fill]="player.isPlaying()" [class.bi-play-fill]="!player.isPlaying()"></i>
                }
              </button>
              <button class="player__ctrl-btn" (click)="player.playNext()" aria-label="Next">
                <i class="bi bi-skip-end-fill"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Expanded Player -->
        @if (isExpanded()) {
          <div class="player__expanded">
            <div class="player__expanded-header">
              <button class="player__collapse-btn" (click)="toggleExpand()">
                <i class="bi bi-chevron-down"></i>
              </button>
              <span class="player__expanded-label">Now Playing</span>
              <button class="player__fav-btn" (click)="toggleFavorite()">
                <i class="bi" [class.bi-heart-fill]="isFav()" [class.bi-heart]="!isFav()"></i>
              </button>
            </div>

            <div class="player__expanded-art">
              <img [src]="player.currentTrack()!.album_image || player.currentTrack()!.image || 'icons/icon-192x192.png'"
                   [alt]="player.currentTrack()!.name"
                   class="player__album-art" />
            </div>

            <div class="player__expanded-info">
              <h2 class="player__track-name">{{ player.currentTrack()!.name }}</h2>
              <p class="player__artist-name">{{ player.currentTrack()!.artist_name }}</p>
            </div>

            <div class="player__seekbar">
              <input type="range" class="player__range"
                     [value]="player.progress()"
                     (input)="onSeek($event)"
                     min="0" max="100" step="0.1" />
              <div class="player__times">
                <span>{{ player.formattedCurrentTime() }}</span>
                <span>{{ player.formattedDuration() }}</span>
              </div>
            </div>

            <div class="player__expanded-controls">
              <button class="player__ctrl-btn player__ctrl-btn--sm"
                      [class.active]="player.isShuffled()"
                      (click)="player.toggleShuffle()" aria-label="Shuffle">
                <i class="bi bi-shuffle"></i>
              </button>
              <button class="player__ctrl-btn" (click)="player.playPrevious()" aria-label="Previous">
                <i class="bi bi-skip-start-fill"></i>
              </button>
              <button class="player__ctrl-btn player__ctrl-btn--play-lg" (click)="player.togglePlay()" aria-label="Play/Pause">
                @if (player.isLoading()) {
                  <i class="bi bi-arrow-repeat player__spin"></i>
                } @else {
                  <i class="bi" [class.bi-pause-fill]="player.isPlaying()" [class.bi-play-fill]="!player.isPlaying()"></i>
                }
              </button>
              <button class="player__ctrl-btn" (click)="player.playNext()" aria-label="Next">
                <i class="bi bi-skip-end-fill"></i>
              </button>
              <button class="player__ctrl-btn player__ctrl-btn--sm"
                      [class.active]="player.repeatMode() !== 'none'"
                      (click)="player.cycleRepeat()" aria-label="Repeat">
                @if (player.repeatMode() === 'one') {
                  <i class="bi bi-repeat-1"></i>
                } @else {
                  <i class="bi bi-repeat"></i>
                }
              </button>
            </div>

            <!-- Volume (desktop only) -->
            <div class="player__volume vo-desktop-only">
              <button class="player__ctrl-btn player__ctrl-btn--sm" (click)="player.toggleMute()">
                <i class="bi" [class.bi-volume-up-fill]="!player.isMuted() && player.volume() > 0.5"
                   [class.bi-volume-down-fill]="!player.isMuted() && player.volume() <= 0.5 && player.volume() > 0"
                   [class.bi-volume-mute-fill]="player.isMuted() || player.volume() === 0"></i>
              </button>
              <input type="range" class="player__volume-range"
                     [value]="player.isMuted() ? 0 : player.volume() * 100"
                     (input)="onVolume($event)"
                     min="0" max="100" step="1" />
            </div>

            <!-- Recently Played Section -->
            <div class="player__recent">
              <h3 class="player__recent-title">Recently Played</h3>
              <div class="player__recent-list">
                @for (track of recentTracks(); track $index) {
                  <app-track-list-item [track]="track" [index]="$index + 1" [trackList]="recentTracks()"></app-track-list-item>
                }
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .player {
      position: fixed;
      left: 0;
      right: 0;
      bottom: var(--vo-bottom-nav-height);
      z-index: 1050;
      transition: all var(--vo-transition-slow);
    }

    // ── Mini Player ──
    .player__mini {
      background: var(--vo-bg-player);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-top: 1px solid var(--vo-border);
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .player__progress-bar-mini {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--vo-bg-input);
    }

    .player__progress-fill-mini {
      height: 100%;
      background: var(--vo-gradient-accent);
      transition: width 0.3s linear;
      border-radius: 0 2px 2px 0;
    }

    .player__mini-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      height: var(--vo-player-height);
    }

    .player__mini-img {
      width: 50px;
      height: 50px;
      border-radius: var(--vo-radius-sm);
      object-fit: cover;
      box-shadow: var(--vo-shadow-sm);
    }

    .player__mini-info {
      flex: 1;
      min-width: 0;
    }

    .player__mini-title {
      font-size: 0.88rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
      color: var(--vo-text-primary);
    }

    .player__mini-artist {
      font-size: 0.75rem;
      color: var(--vo-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 2px 0 0;
    }

    .player__mini-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    // ── Control Buttons ──
    .player__ctrl-btn {
      background: none;
      border: none;
      color: var(--vo-text-primary);
      font-size: 1.3rem;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all var(--vo-transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: var(--vo-bg-input);
        transform: scale(1.05);
      }

      &--sm {
        font-size: 1rem;
        color: var(--vo-text-secondary);

        &.active {
          color: var(--vo-accent);
          text-shadow: 0 0 10px var(--vo-accent-glow);
        }
      }

      &--play {
        font-size: 1.5rem;
        width: 44px;
        height: 44px;
        background: var(--vo-accent);
        color: #fff;
        border-radius: 50%;

        &:hover {
          background: var(--vo-accent-light);
          box-shadow: var(--vo-shadow-glow);
        }
      }

      &--play-lg {
        font-size: 1.8rem;
        width: 64px;
        height: 64px;
        background: var(--vo-gradient-accent);
        color: #fff;
        border-radius: 50%;
        box-shadow: var(--vo-shadow-glow);

        &:hover {
          transform: scale(1.08);
          box-shadow: 0 0 30px rgba(108, 92, 231, 0.4);
        }
      }
    }

    // ── Expanded Player ──
    .player--expanded {
      bottom: 0;
      top: 0;
      z-index: 2000;

      .player__mini {
        display: none;
      }
    }

    .player__expanded {
      position: fixed;
      inset: 0;
      background: var(--vo-bg-primary);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 24px env(safe-area-inset-bottom, 24px);
      overflow-y: auto;
      animation: slideUp 0.35s ease;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .player__expanded-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 420px;
      margin-bottom: 20px;
    }

    .player__collapse-btn,
    .player__fav-btn {
      background: none;
      border: none;
      color: var(--vo-text-secondary);
      font-size: 1.4rem;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all var(--vo-transition-fast);

      &:hover {
        color: var(--vo-text-primary);
        background: var(--vo-bg-input);
      }
    }

    .player__fav-btn .bi-heart-fill {
      color: #ff6b6b;
    }

    .player__expanded-label {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--vo-text-muted);
    }

    .player__expanded-art {
      width: 100%;
      max-width: 320px;
      aspect-ratio: 1;
      margin: 10px 0 24px;
    }

    .player__album-art {
      width: 100%;
      height: 100%;
      border-radius: var(--vo-radius-xl);
      object-fit: cover;
      box-shadow: var(--vo-shadow-lg);
    }

    .player__recent {
      width: 100%;
      max-width: 420px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    .player__recent-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 16px;
      color: var(--vo-text-primary);
    }

    .player__recent-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .player__expanded-info {
      text-align: center;
      width: 100%;
      max-width: 420px;
      margin-bottom: 20px;
    }

    .player__track-name {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player__artist-name {
      font-size: 0.9rem;
      color: var(--vo-text-secondary);
      margin: 6px 0 0;
    }

    // ── Seekbar ──
    .player__seekbar {
      width: 100%;
      max-width: 420px;
      margin-bottom: 16px;
    }

    .player__range,
    .player__volume-range {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: var(--vo-bg-input);
      border-radius: 2px;
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--vo-accent);
        cursor: pointer;
        box-shadow: 0 0 8px rgba(108, 92, 231, 0.4);
        transition: transform var(--vo-transition-fast);

        &:hover {
          transform: scale(1.3);
        }
      }

      &::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--vo-accent);
        cursor: pointer;
        border: none;
      }
    }

    .player__times {
      display: flex;
      justify-content: space-between;
      font-size: 0.72rem;
      color: var(--vo-text-muted);
      margin-top: 6px;
    }

    .player__expanded-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      width: 100%;
      max-width: 420px;
      margin-bottom: 20px;
    }

    .player__volume {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      max-width: 200px;
    }

    .player__volume-range {
      flex: 1;
    }

    .player__spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    // ── Desktop styles ──
    @media (min-width: 769px) {
      .player {
        bottom: 0;
        left: 240px;
      }

      .player--expanded {
        left: 0;
      }
    }
  `],
})
export class PlayerComponent {
  readonly player = inject(PlayerService);
  private readonly storage = inject(StorageService);

  readonly isExpanded = signal(false);
  readonly isFav = signal(false);
  readonly recentTracks = signal<Track[]>([]);

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
    if (this.isExpanded() && this.player.currentTrack()) {
      this.isFav.set(this.storage.isFavorite(this.player.currentTrack()!.id));
      
      // Get the 5 most recently played tracks, excluding the currently playing one
      const currentId = this.player.currentTrack()!.id;
      const recent = this.storage.getRecentTracks()
        .filter(t => t.id !== currentId)
        .slice(0, 5);
      this.recentTracks.set(recent);
    }
  }

  toggleFavorite(): void {
    const track = this.player.currentTrack();
    if (track) {
      const result = this.storage.toggleFavorite(track);
      this.isFav.set(result);
    }
  }

  onSeek(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.player.seekTo(value);
  }

  onVolume(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.player.setVolume(value / 100);
  }
}
