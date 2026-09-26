// ============================================
// YakBeats — Playlist / Album Card
// ============================================

import { ArtPipe } from '../art.pipe';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Collection } from '../../models';

@Component({
  selector: 'app-collection-card',
  standalone: true,
  imports: [RouterLink, ArtPipe],
  template: `
    <a class="coll-card" [routerLink]="['/collection', collection().ref]">
      <span class="coll-card__img">
        @if (collection().image) {
          <img [src]="collection().image | art" [alt]="collection().name" loading="lazy" />
        } @else {
          <i class="bi bi-music-note-list"></i>
        }
        <span class="coll-card__play"><i class="bi bi-play-fill"></i></span>
      </span>
      <span class="coll-card__name">{{ collection().name }}</span>
      <span class="coll-card__meta">
        {{ collection().isAlbum ? 'Album' : 'Playlist' }}@if (collection().owner) { · {{ collection().owner }} }
      </span>
    </a>
  `,
  styles: [`
    .coll-card {
      display: flex; flex-direction: column; gap: 2px; width: 160px; padding: 8px;
      border-radius: var(--vo-radius-md); text-decoration: none; color: var(--vo-text-primary);
      transition: background var(--vo-transition-fast);
      &:hover { background: var(--vo-bg-input); .coll-card__play { opacity: 1; transform: none; } }
    }
    .coll-card__img {
      position: relative; aspect-ratio: 1; border-radius: var(--vo-radius-md); overflow: hidden; margin-bottom: 8px;
      display: flex; align-items: center; justify-content: center;
      background: var(--vo-gradient-accent); color: #fff; font-size: 2.5rem; box-shadow: var(--vo-shadow-md);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .coll-card__play {
      position: absolute; right: 8px; bottom: 8px; width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
      background: var(--vo-accent); color: #fff; box-shadow: var(--vo-shadow-md);
      opacity: 0; transform: translateY(6px); transition: all var(--vo-transition);
    }
    .coll-card__name { font-weight: 700; font-size: 0.86rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .coll-card__meta { font-size: 0.74rem; color: var(--vo-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media (hover: none) { .coll-card__play { opacity: 0.95; transform: none; width: 32px; height: 32px; font-size: 1.1rem; } }
    @media (max-width: 576px) { .coll-card { width: 140px; } }
  `],
})
export class CollectionCardComponent {
  readonly collection = input.required<Collection>();
}
