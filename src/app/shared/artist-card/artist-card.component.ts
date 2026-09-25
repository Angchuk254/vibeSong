// ============================================
// vibeOnly — Artist Card
// ============================================

import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArtistSummary } from '../../models';

@Component({
  selector: 'app-artist-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="artist-card" [routerLink]="['/artist', artist().ref]">
      <span class="artist-card__img">
        @if (artist().image) {
          <img [src]="artist().image" [alt]="artist().name" loading="lazy" />
        } @else {
          <i class="bi bi-person-fill"></i>
        }
      </span>
      <span class="artist-card__name">
        {{ artist().name }}
        @if (artist().verified) { <i class="bi bi-patch-check-fill verified" title="Verified"></i> }
      </span>
      <span class="artist-card__meta">Artist</span>
    </a>
  `,
  styles: [`
    .artist-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      width: 150px; padding: 10px; border-radius: var(--vo-radius-md);
      text-decoration: none; color: var(--vo-text-primary);
      transition: background var(--vo-transition-fast);
      &:hover { background: var(--vo-bg-input); }
    }
    .artist-card__img {
      width: 128px; height: 128px; border-radius: 50%; overflow: hidden; margin-bottom: 6px;
      display: flex; align-items: center; justify-content: center;
      background: var(--vo-bg-card); color: var(--vo-text-muted); font-size: 3rem;
      box-shadow: var(--vo-shadow-md);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .artist-card__name {
      max-width: 100%; font-weight: 700; font-size: 0.88rem; text-align: center;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .verified { color: #3d91ff; font-size: 0.75rem; }
    .artist-card__meta { font-size: 0.75rem; color: var(--vo-text-muted); }
    @media (max-width: 576px) {
      .artist-card { width: 124px; }
      .artist-card__img { width: 104px; height: 104px; }
    }
  `],
})
export class ArtistCardComponent {
  readonly artist = input.required<ArtistSummary>();
}
