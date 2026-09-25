// ============================================
// vibeOnly — Track List Item Component
// ============================================

import { Component, input, output, inject } from '@angular/core';
import { Track } from '../../models';
import { PlayerService } from '../../services';
import { DurationPipe } from '../../pipes';
import { TrackMenuComponent } from '../track-menu/track-menu.component';
import { sourceMeta } from '../source-badge';

@Component({
  selector: 'app-track-list-item',
  standalone: true,
  imports: [DurationPipe, TrackMenuComponent],
  template: `
    <div class="track-item" 
         (click)="onPlay()" 
         (keydown.enter)="onPlay()"
         (keydown.space)="onPlay()"
         tabindex="0"
         role="button"
         [attr.aria-label]="'Play ' + track().name"
         [class.is-playing]="isCurrentlyPlaying()">
      <div class="track-item__index">
        @if (isCurrentlyPlaying()) {
          <div class="track-item__equalizer">
            <span></span><span></span><span></span>
          </div>
        } @else {
          <span class="track-item__num">{{ index() }}</span>
        }
      </div>
      <img class="track-item__img"
           [src]="track().album_image || track().image || 'icons/icon-192x192.png'"
           [alt]="track().name"
           loading="lazy" />
      <div class="track-item__info">
        <h4 class="track-item__title"><span class="track-item__name">{{ track().name }}</span></h4>
        <p class="track-item__artist">
          @if (track().isLive || track().provider === 'radio') {
            <span class="vo-badge vo-badge--live">LIVE</span>
          } @else if (track().isPreview) {
            <span class="vo-badge">PREVIEW</span>
          }
          <i class="bi provider-icon" [class]="source().icon" [title]="source().label"></i>
          <span class="track-item__artist-name">{{ track().artist_name }}</span>
        </p>
      </div>
      <span class="track-item__duration">
        @if (track().isLive || track().provider === 'radio') { <i class="bi bi-broadcast"></i> } @else { {{ track().duration | duration }} }
      </span>
      <button class="track-item__fav" (click)="onToggleFavorite($event)"
              [attr.aria-label]="isFav() ? 'Remove from Liked Songs' : 'Save to Liked Songs'">
        <i class="bi" [class.bi-heart-fill]="isFav()" [class.bi-heart]="!isFav()"></i>
      </button>
      <app-track-menu [track]="track()" [removable]="removable()" (remove)="remove.emit($event)" (click)="$event.stopPropagation()"></app-track-menu>
    </div>
  `,
  styles: [`
    .track-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--vo-radius-md);
      cursor: pointer;
      transition: background var(--vo-transition-fast);

      &:hover {
        background: var(--vo-bg-input);
      }

      &.is-playing {
        background: var(--vo-bg-input);

        .track-item__title {
          color: var(--vo-accent-light);
        }
      }
    }

    .track-item__index {
      width: 28px;
      text-align: center;
      flex-shrink: 0;
    }

    .track-item__num {
      font-size: 0.8rem;
      color: var(--vo-text-muted);
      font-weight: 500;
    }

    .track-item__equalizer {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      height: 16px;

      span {
        width: 3px;
        background: var(--vo-accent);
        border-radius: 2px;
        animation: equalizerBounce 0.6s ease infinite alternate;

        &:nth-child(1) { height: 8px; animation-delay: 0s; }
        &:nth-child(2) { height: 14px; animation-delay: 0.2s; }
        &:nth-child(3) { height: 6px; animation-delay: 0.4s; }
      }
    }

    @keyframes equalizerBounce {
      from { height: 4px; }
      to { height: 16px; }
    }

    .track-item__img {
      width: 44px;
      height: 44px;
      border-radius: var(--vo-radius-sm);
      object-fit: cover;
      flex-shrink: 0;
      background: var(--vo-bg-card);
    }

    .track-item__info {
      flex: 1;
      min-width: 0;
    }

    .track-item__title {
      font-size: 0.9rem;
      font-weight: 600;
      margin: 0;
      color: var(--vo-text-primary);
      display: flex;
      min-width: 0;
    }

    .track-item__name,
    .track-item__artist-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .provider-icon {
      font-size: 0.75rem;
      color: var(--vo-text-muted);
      opacity: 0.7;
    }

    .track-item__artist {
      font-size: 0.78rem;
      color: var(--vo-text-secondary);
      margin: 2px 0 0;
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .track-item__duration {
      font-size: 0.78rem;
      color: var(--vo-text-muted);
      flex-shrink: 0;
    }

    .track-item__fav {
      background: none;
      border: none;
      color: var(--vo-text-muted);
      cursor: pointer;
      padding: 6px;
      font-size: 1rem;
      transition: color var(--vo-transition-fast);
      flex-shrink: 0;

      &:hover {
        color: var(--vo-text-primary);
      }

      .bi-heart-fill {
        color: #ff6b6b;
      }
    }

    @media (max-width: 576px) {
      .track-item {
        gap: 10px;
        padding: 8px;
      }
      .track-item__img {
        width: 40px;
        height: 40px;
      }
      .track-item__duration {
        display: none;
      }
    }
  `],
})
export class TrackListItemComponent {
  readonly track = input.required<Track>();
  readonly index = input(0);
  readonly trackList = input<Track[]>([]);
  /** Show "Remove from this playlist" in the menu */
  readonly removable = input(false);
  readonly remove = output<Track>();

  private player = inject(PlayerService);

  isFav(): boolean {
    return this.player.isFavorite(this.track().id);
  }

  source() {
    return sourceMeta(this.track());
  }

  isCurrentlyPlaying(): boolean {
    const current = this.player.currentTrack();
    return current !== null && current.id === this.track().id && this.player.isPlaying();
  }

  onPlay(): void {
    const list = this.trackList().length > 0 ? this.trackList() : undefined;
    this.player.playTrack(this.track(), list);
  }

  onToggleFavorite(event: Event): void {
    event.stopPropagation();
    this.player.toggleFavorite(this.track());
  }
}
