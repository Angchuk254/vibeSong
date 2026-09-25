// ============================================
// YakBeats — Track Card Component
// ============================================

import { Component, input, output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Track } from '../../models';
import { PlayerService } from '../../services';
import { DurationPipe } from '../../pipes';
import { sourceMeta } from '../source-badge';

@Component({
  selector: 'app-track-card',
  standalone: true,
  imports: [DurationPipe],
  template: `
    <div class="track-card" tabindex="0" role="button" [attr.aria-label]="'Play ' + track().name"
         (click)="onPlay()" (keydown.enter)="onPlay()" [class.is-playing]="isCurrentlyPlaying()">
      <div class="track-card__image">
        <img [src]="track().album_image || track().image || 'icons/icon-192x192.png'"
             [alt]="track().name"
             loading="lazy" />
        <div class="track-card__overlay">
          <button class="track-card__play-btn" aria-label="Play">
            <i class="bi" [class.bi-pause-fill]="isCurrentlyPlaying()" [class.bi-play-fill]="!isCurrentlyPlaying()"></i>
          </button>
        </div>
        @if (track().provider) {
          <div class="track-card__provider" [title]="source().label">
            <i class="bi" [class]="source().icon"></i>
            @if (track().isLive || track().provider === 'radio') { <span>LIVE</span> }
            @else if (track().isPreview) { <span>PREVIEW</span> }
          </div>
        }
        @if (showFavorite()) {
          <button class="track-card__fav-btn"
                  (click)="onToggleFavorite($event)"
                  [attr.aria-label]="isFav() ? 'Remove from Liked Songs' : 'Save to Liked Songs'">
            <i class="bi" [class.bi-heart-fill]="isFav()" [class.bi-heart]="!isFav()"></i>
          </button>
        }
        <button class="track-card__queue-btn" (click)="onQueue($event)" aria-label="Add to queue" title="Add to queue">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>
      <div class="track-card__info">
        <h4 class="track-card__title" [title]="track().name">{{ track().name }}</h4>
        <p class="track-card__artist">
          @if (track().artistRef) {
            <a class="artist-link" (click)="openArtist($event)" (keydown.enter)="openArtist($event)" tabindex="0">{{ track().artist_name }}</a>
          } @else {
            {{ track().artist_name }}
          }
        </p>
        @if (showDuration()) {
          <span class="track-card__duration">{{ track().duration | duration }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .track-card {
      width: 155px;
      cursor: pointer;
      transition: transform var(--vo-transition);

      &:hover {
        transform: translateY(-4px);
      }

      &.is-playing .track-card__title {
        color: var(--vo-accent-light);
      }

      &.is-playing .track-card__overlay {
        opacity: 1;
      }
    }

    .track-card__image {
      position: relative;
      width: 155px;
      height: 155px;
      border-radius: var(--vo-radius-md);
      overflow: hidden;
      background: var(--vo-bg-card);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform var(--vo-transition-slow);
      }

      &:hover img {
        transform: scale(1.05);
      }
    }

    .track-card__overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity var(--vo-transition);

      .track-card__image:hover & {
        opacity: 1;
      }
    }

    .track-card__play-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--vo-accent);
      border: none;
      color: #fff;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform var(--vo-transition-fast);
      box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);

      &:hover {
        transform: scale(1.1);
      }
    }

    .track-card__fav-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      border: none;
      color: #fff;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.85rem;
      opacity: 0;
      transition: opacity var(--vo-transition);

      .track-card__image:hover & {
        opacity: 1;
      }

      .bi-heart-fill {
        color: #ff6b6b;
      }
    }

    .track-card__provider {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      color: #fff;
      padding: 4px 6px;
      border-radius: var(--vo-radius-sm);
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      z-index: 1;

      span {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.06em;
      }
    }

    .track-card__queue-btn {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      border: none;
      color: #fff;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.9rem;
      opacity: 0;
      z-index: 2;
      transition: opacity var(--vo-transition);

      .track-card__image:hover & {
        opacity: 1;
      }
    }

    @media (hover: none) {
      .track-card__fav-btn,
      .track-card__queue-btn {
        opacity: 0.9;
      }
    }

    .track-card__info {
      padding: 10px 2px 0;
    }

    .track-card__title {
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--vo-text-primary);
      margin: 0;
      line-height: 1.3;
    }

    .track-card__artist {
      font-size: 0.75rem;
      color: var(--vo-text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 2px 0 0;
    }

    .track-card__duration {
      font-size: 0.7rem;
      color: var(--vo-text-muted);
    }

    @media (max-width: 576px) {
      .track-card {
        width: 135px;
      }
      .track-card__image {
        width: 135px;
        height: 135px;
      }
    }
  `],
})
export class TrackCardComponent {
  readonly track = input.required<Track>();
  readonly showFavorite = input(true);
  readonly showDuration = input(false);
  readonly trackList = input<Track[]>([]);
  readonly played = output<Track>();

  private player = inject(PlayerService);
  private router = inject(Router);

  openArtist(e: Event): void {
    e.stopPropagation();
    const ref = this.track().artistRef;
    if (ref) this.router.navigate(['/artist', ref]);
  }

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
    if (this.player.currentTrack()?.id === this.track().id) {
      this.player.togglePlay();
      return;
    }
    const list = this.trackList().length > 0 ? this.trackList() : undefined;
    this.player.playTrack(this.track(), list);
    this.played.emit(this.track());
  }

  onToggleFavorite(event: Event): void {
    event.stopPropagation();
    this.player.toggleFavorite(this.track());
  }

  onQueue(event: Event): void {
    event.stopPropagation();
    this.player.addToQueue([this.track()]);
  }
}
