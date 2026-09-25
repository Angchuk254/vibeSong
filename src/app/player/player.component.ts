// ============================================
// vibeOnly — Music Player Component
// ============================================

import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { PlayerService, StorageService, LibraryService } from '../services';
import { TrackListItemComponent } from '../shared/track-list-item/track-list-item.component';
import { sourceMeta } from '../shared/source-badge';
import { Track } from '../models';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [TrackListItemComponent],
  template: `
    @if (player.notice()) {
      <div class="player__toast" role="status" aria-live="polite">{{ player.notice() }}</div>
    }

    @if (player.isPlayerVisible() && player.currentTrack(); as track) {
      <div class="player" [class.player--expanded]="isExpanded()">
        <!-- Mini Player (default) -->
        <div class="player__mini" tabindex="0" role="button" aria-label="Open player" (click)="toggleExpand()" (keydown.enter)="toggleExpand()">
          <div class="player__progress-bar-mini">
            <div class="player__progress-fill-mini"
                 [class.player__progress-fill-mini--live]="player.isLive()"
                 [style.width.%]="player.isLive() ? 100 : player.progress()">
            </div>
          </div>

          <div class="player__mini-content">
            <img class="player__mini-img"
                 [src]="art(track)"
                 [alt]="track.name" />
            <div class="player__mini-info">
              <p class="player__mini-title">{{ track.name }}</p>
              <p class="player__mini-artist">
                @if (player.isLive()) { <span class="vo-badge vo-badge--live">LIVE</span> }
                @else if (track.isPreview) { <span class="vo-badge">PREVIEW</span> }
                {{ track.artist_name }}
              </p>
            </div>
            <div class="player__mini-controls" role="group" tabindex="-1" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
              <button class="player__ctrl-btn player__ctrl-btn--sm player__mini-fav" (click)="player.toggleFavorite(track)"
                      [attr.aria-label]="player.isFavorite(track.id) ? 'Remove from Liked Songs' : 'Save to Liked Songs'">
                <i class="bi" [class.bi-heart-fill]="player.isFavorite(track.id)" [class.bi-heart]="!player.isFavorite(track.id)"></i>
              </button>
              <button class="player__ctrl-btn vo-desktop-only" (click)="player.playPrevious()" aria-label="Previous">
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
            <div class="player__backdrop" [style.background-image]="'url(' + art(track) + ')'"></div>

            <div class="player__expanded-header">
              <button class="player__collapse-btn" (click)="toggleExpand()" aria-label="Minimise player">
                <i class="bi bi-chevron-down"></i>
              </button>
              <span class="player__expanded-label">{{ source(track).label }}</span>
              <div class="player__header-actions">
                <button class="player__collapse-btn" (click)="library.openPicker(track)" aria-label="Add to playlist" title="Add to playlist">
                  <i class="bi bi-plus-square"></i>
                </button>
                <button class="player__fav-btn" (click)="player.toggleFavorite(track)"
                        [attr.aria-label]="player.isFavorite(track.id) ? 'Remove from Liked Songs' : 'Save to Liked Songs'">
                  <i class="bi" [class.bi-heart-fill]="player.isFavorite(track.id)" [class.bi-heart]="!player.isFavorite(track.id)"></i>
                </button>
              </div>
            </div>

            <div class="player__expanded-art" [class.player__expanded-art--playing]="player.isPlaying()">
              <img [src]="art(track)"
                   [alt]="track.name"
                   class="player__album-art" />
            </div>

            <div class="player__expanded-info">
              <h2 class="player__track-name" [title]="track.name">{{ track.name }}</h2>
              <p class="player__artist-name">
                {{ track.artist_name }}
                @if (track.genre) { <span class="player__genre">· {{ track.genre }}</span> }
              </p>
              @if (track.isPreview) {
                <p class="player__hint"><i class="bi bi-info-circle"></i> 30-second preview — full song isn't free to stream</p>
              }
            </div>

            <div class="player__seekbar">
              @if (player.isLive()) {
                <div class="player__live-bar"><span class="vo-badge vo-badge--live">LIVE</span> Streaming live radio</div>
              } @else {
                <input type="range" class="player__range"
                       [value]="player.progress()"
                       [style.--fill.%]="player.progress()"
                       (input)="onSeek($event)"
                       aria-label="Seek"
                       min="0" max="100" step="0.1" />
                <div class="player__times">
                  <span>{{ player.formattedCurrentTime() }}</span>
                  <span>{{ player.formattedDuration() }}</span>
                </div>
              }
            </div>

            <div class="player__expanded-controls">
              <button class="player__ctrl-btn player__ctrl-btn--sm"
                      [class.active]="player.isShuffled()"
                      (click)="player.toggleShuffle()" aria-label="Shuffle" title="Shuffle (S)">
                <i class="bi bi-shuffle"></i>
              </button>
              <button class="player__ctrl-btn" (click)="player.playPrevious()" aria-label="Previous" title="Previous (Shift+←)">
                <i class="bi bi-skip-start-fill"></i>
              </button>
              <button class="player__ctrl-btn player__ctrl-btn--play-lg" (click)="player.togglePlay()" aria-label="Play/Pause" title="Play/Pause (Space)">
                @if (player.isLoading()) {
                  <i class="bi bi-arrow-repeat player__spin"></i>
                } @else {
                  <i class="bi" [class.bi-pause-fill]="player.isPlaying()" [class.bi-play-fill]="!player.isPlaying()"></i>
                }
              </button>
              <button class="player__ctrl-btn" (click)="player.playNext()" aria-label="Next" title="Next (Shift+→)">
                <i class="bi bi-skip-end-fill"></i>
              </button>
              <button class="player__ctrl-btn player__ctrl-btn--sm"
                      [class.active]="player.repeatMode() !== 'none'"
                      (click)="player.cycleRepeat()" aria-label="Repeat" title="Repeat (R)">
                @if (player.repeatMode() === 'one') {
                  <i class="bi bi-repeat-1"></i>
                } @else {
                  <i class="bi bi-repeat"></i>
                }
              </button>
            </div>

            <div class="player__extras">
              <button class="player__chip" [class.active]="player.autoplay()" (click)="player.toggleAutoplay()"
                      title="Keep playing similar songs when the queue ends">
                <i class="bi bi-infinity"></i> Autoplay {{ player.autoplay() ? 'on' : 'off' }}
              </button>
              <div class="player__sleep">
                <button class="player__chip" [class.active]="player.sleepAt() !== null" (click)="sleepMenu.set(!sleepMenu())">
                  <i class="bi bi-moon-stars"></i> {{ sleepLabel() }}
                </button>
                @if (sleepMenu()) {
                  <div class="player__sleep-menu">
                    @for (m of sleepOptions; track m) {
                      <button (click)="setSleep(m)">{{ m }} minutes</button>
                    }
                    <button (click)="setSleep('track')">End of this song</button>
                    @if (player.sleepAt() !== null) {
                      <button class="danger" (click)="setSleep(null)">Turn off</button>
                    }
                  </div>
                }
              </div>
              <div class="player__volume vo-desktop-only">
                <button class="player__ctrl-btn player__ctrl-btn--sm" (click)="player.toggleMute()" aria-label="Mute (M)">
                  <i class="bi" [class.bi-volume-up-fill]="!player.isMuted() && player.volume() > 0.5"
                     [class.bi-volume-down-fill]="!player.isMuted() && player.volume() <= 0.5 && player.volume() > 0"
                     [class.bi-volume-mute-fill]="player.isMuted() || player.volume() === 0"></i>
                </button>
                <input type="range" class="player__volume-range"
                       [value]="player.isMuted() ? 0 : player.volume() * 100"
                       (input)="onVolume($event)"
                       aria-label="Volume"
                       min="0" max="100" step="1" />
              </div>
            </div>

            <!-- Up Next / Recently Played -->
            <div class="player__recent">
              <div class="player__tabs">
                <button [class.active]="panel() === 'queue'" (click)="panel.set('queue')">Up Next ({{ player.upNext().length }})</button>
                <button [class.active]="panel() === 'recent'" (click)="showRecent()">Recently Played</button>
                @if (panel() === 'queue' && player.upNext().length > 0) {
                  <button class="player__clear" (click)="player.clearQueue()">Clear</button>
                }
              </div>

              @if (panel() === 'queue') {
                <div class="player__queue">
                  @for (q of player.upNext(); track q.id; let i = $index) {
                    <div class="player__q-item">
                      <button class="player__q-main" (click)="player.playAt(player.queueIndex() + 1 + i)">
                        <img [src]="art(q)" alt="" loading="lazy" />
                        <span class="player__q-text">
                          <span class="player__q-name">{{ q.name }}</span>
                          <span class="player__q-artist">
                            @if (q.isPreview) { <span class="vo-badge">PREVIEW</span> }
                            {{ q.artist_name }}
                          </span>
                        </span>
                      </button>
                      <button class="player__q-btn" (click)="player.moveInQueue(player.queueIndex() + 1 + i, -1)" [disabled]="i === 0" aria-label="Move up">
                        <i class="bi bi-chevron-up"></i>
                      </button>
                      <button class="player__q-btn" (click)="player.moveInQueue(player.queueIndex() + 1 + i, 1)" [disabled]="i === player.upNext().length - 1" aria-label="Move down">
                        <i class="bi bi-chevron-down"></i>
                      </button>
                      <button class="player__q-btn" (click)="player.removeFromQueue(player.queueIndex() + 1 + i)" aria-label="Remove from queue">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    </div>
                  } @empty {
                    <p class="player__empty">
                      @if (player.autoplay()) { Queue is empty — Autoplay will pick similar songs next. }
                      @else { Queue is empty. Use "Add to queue" on any song. }
                    </p>
                  }
                </div>
              } @else {
                <div class="player__recent-list">
                  @for (t of recentTracks(); track t.id) {
                    <app-track-list-item [track]="t" [index]="$index + 1" [trackList]="recentTracks()"></app-track-list-item>
                  }
                </div>
              }
            </div>

            <p class="player__shortcuts vo-desktop-only">
              Space play/pause · ←/→ seek 10s · Shift+←/→ prev/next · ↑/↓ volume · S shuffle · R repeat · L like · M mute
            </p>
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

    // ── Toast ──
    .player__toast {
      position: fixed;
      left: 50%;
      bottom: calc(var(--vo-bottom-nav-height) + var(--vo-player-height) + 16px);
      transform: translateX(-50%);
      z-index: 5000;
      max-width: calc(100vw - 32px);
      padding: 10px 18px;
      border-radius: var(--vo-radius-xl);
      background: var(--vo-text-primary);
      color: var(--vo-bg-primary);
      font-size: 0.85rem;
      font-weight: 600;
      box-shadow: var(--vo-shadow-md);
      animation: toastIn 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 8px); }
    }

    .player__mini-artist {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .player__mini-fav .bi-heart-fill,
    .player__fav-btn .bi-heart-fill {
      color: #ff6b6b;
    }

    .player__progress-fill-mini--live {
      background: #e5484d;
      opacity: 0.6;
    }

    // ── Expanded extras ──
    .player__backdrop {
      position: fixed;
      inset: -40px;
      background-size: cover;
      background-position: center;
      filter: blur(60px) saturate(1.4);
      opacity: 0.35;
      z-index: -1;
      pointer-events: none;
    }

    .player__expanded {
      isolation: isolate;
    }

    .player__header-actions {
      display: flex;
      align-items: center;
    }

    .player__expanded-art img {
      transition: transform 0.4s ease;
      transform: scale(0.94);
    }

    .player__expanded-art--playing img {
      transform: scale(1);
    }

    .player__genre {
      color: var(--vo-text-muted);
    }

    .player__hint {
      margin: 8px 0 0;
      font-size: 0.75rem;
      color: var(--vo-text-muted);
    }

    .player__range {
      background: linear-gradient(to right, var(--vo-accent) var(--fill, 0%), var(--vo-bg-input) var(--fill, 0%));
    }

    .player__live-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--vo-text-secondary);
      padding: 6px 0;
    }

    .player__extras {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      width: 100%;
      max-width: 420px;
    }

    .player__chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--vo-radius-xl);
      border: 1px solid var(--vo-border-light);
      background: var(--vo-bg-input);
      color: var(--vo-text-secondary);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;

      &.active {
        color: var(--vo-accent-light);
        border-color: var(--vo-accent);
      }
    }

    .player__sleep {
      position: relative;
    }

    .player__sleep-menu {
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      min-width: 170px;
      padding: 6px;
      display: flex;
      flex-direction: column;
      background: var(--vo-bg-card);
      border: 1px solid var(--vo-border-light);
      border-radius: var(--vo-radius-md);
      box-shadow: var(--vo-shadow-lg);

      button {
        background: none;
        border: none;
        text-align: left;
        padding: 8px 10px;
        border-radius: var(--vo-radius-sm);
        color: var(--vo-text-primary);
        font-size: 0.85rem;
        cursor: pointer;

        &:hover { background: var(--vo-bg-input); }
        &.danger { color: #ff6b6b; }
      }
    }

    .player__tabs {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;

      button {
        background: none;
        border: none;
        padding: 6px 12px;
        border-radius: var(--vo-radius-xl);
        color: var(--vo-text-secondary);
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;

        &.active {
          background: var(--vo-text-primary);
          color: var(--vo-bg-primary);
        }
      }

      .player__clear {
        margin-left: auto;
        font-weight: 500;
        color: var(--vo-text-muted);
      }
    }

    .player__queue {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .player__q-item {
      display: flex;
      align-items: center;
      gap: 2px;
      border-radius: var(--vo-radius-md);

      &:hover { background: var(--vo-bg-input); }
    }

    .player__q-main {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: none;
      border: none;
      color: inherit;
      text-align: left;
      cursor: pointer;

      img {
        width: 40px;
        height: 40px;
        border-radius: var(--vo-radius-sm);
        object-fit: cover;
        flex-shrink: 0;
      }
    }

    .player__q-text {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .player__q-name,
    .player__q-artist {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player__q-name {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--vo-text-primary);
    }

    .player__q-artist {
      font-size: 0.75rem;
      color: var(--vo-text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .player__q-btn {
      background: none;
      border: none;
      color: var(--vo-text-muted);
      padding: 6px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 0.8rem;

      &:hover:not(:disabled) { color: var(--vo-text-primary); }
      &:disabled { opacity: 0.25; cursor: default; }
    }

    .player__empty {
      color: var(--vo-text-muted);
      font-size: 0.85rem;
      padding: 12px 0;
      margin: 0;
    }

    .player__shortcuts {
      margin: 24px 0 8px;
      font-size: 0.7rem;
      color: var(--vo-text-muted);
      text-align: center;
      max-width: 420px;
    }

    @media (min-width: 769px) {
      .player__toast {
        left: calc(50% + 120px);
        bottom: calc(var(--vo-player-height) + 16px);
      }
    }
  `],
})
export class PlayerComponent {
  readonly player = inject(PlayerService);
  readonly library = inject(LibraryService);
  private readonly storage = inject(StorageService);

  readonly isExpanded = signal(false);
  readonly recentTracks = signal<Track[]>([]);
  readonly panel = signal<'queue' | 'recent'>('queue');
  readonly sleepMenu = signal(false);
  readonly sleepOptions = [15, 30, 45, 60, 90];
  private readonly now = signal(Date.now());

  readonly sleepLabel = computed(() => {
    const at = this.player.sleepAt();
    if (at === null) return 'Sleep timer';
    if (at === 'track') return 'Stops after song';
    const mins = Math.max(1, Math.ceil((at - this.now()) / 60000));
    return `Sleep in ${mins} min`;
  });

  constructor() {
    // Keeps the sleep countdown label fresh
    setInterval(() => this.now.set(Date.now()), 30000);
  }

  art(track: Track): string {
    return track.album_image || track.image || 'icons/icon-192x192.png';
  }

  source(track: Track) {
    return sourceMeta(track);
  }

  toggleExpand(): void {
    this.isExpanded.update((v) => !v);
    this.sleepMenu.set(false);
    if (this.isExpanded() && this.panel() === 'recent') this.showRecent();
  }

  showRecent(): void {
    this.panel.set('recent');
    const currentId = this.player.currentTrack()?.id;
    this.recentTracks.set(this.storage.getRecentTracks().filter((t) => t.id !== currentId).slice(0, 10));
  }

  setSleep(m: number | 'track' | null): void {
    this.player.setSleepTimer(m);
    this.now.set(Date.now());
    this.sleepMenu.set(false);
  }

  onSeek(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.player.seekTo(value);
  }

  onVolume(event: Event): void {
    const value = +(event.target as HTMLInputElement).value;
    this.player.setVolume(value / 100);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const track = this.player.currentTrack();
    if (!track) return;

    const handled = (() => {
      switch (e.key) {
        case ' ':
        case 'k':
          // Let buttons/links keep their own space behaviour
          if (e.key === ' ' && target?.closest('button, a, [role="button"]')) return false;
          this.player.togglePlay();
          return true;
        case 'ArrowRight':
          if (e.shiftKey) this.player.playNext(); else this.player.seekBy(10);
          return true;
        case 'ArrowLeft':
          if (e.shiftKey) this.player.playPrevious(); else this.player.seekBy(-10);
          return true;
        case 'ArrowUp':
          this.player.setVolume(this.player.volume() + 0.05);
          return true;
        case 'ArrowDown':
          this.player.setVolume(this.player.volume() - 0.05);
          return true;
        case 's':
        case 'S':
          this.player.toggleShuffle();
          return true;
        case 'r':
        case 'R':
          this.player.cycleRepeat();
          return true;
        case 'l':
        case 'L':
          this.player.toggleFavorite(track);
          return true;
        case 'm':
        case 'M':
          this.player.toggleMute();
          return true;
        case 'Escape':
          if (this.isExpanded()) {
            this.isExpanded.set(false);
            return true;
          }
          return false;
        default:
          return false;
      }
    })();
    if (handled) e.preventDefault();
  }
}
