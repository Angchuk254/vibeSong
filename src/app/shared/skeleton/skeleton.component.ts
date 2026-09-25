// ============================================
// YakBeats — Skeleton Loader Component
// ============================================

import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @switch (type()) {
      @case ('card') {
        <div class="skeleton-card">
          <div class="skeleton-card__image vo-skeleton"></div>
          <div class="skeleton-card__title vo-skeleton"></div>
          <div class="skeleton-card__subtitle vo-skeleton"></div>
        </div>
      }
      @case ('list') {
        <div class="skeleton-list">
          <div class="skeleton-list__img vo-skeleton"></div>
          <div class="skeleton-list__info">
            <div class="skeleton-list__title vo-skeleton"></div>
            <div class="skeleton-list__subtitle vo-skeleton"></div>
          </div>
        </div>
      }
      @case ('hero') {
        <div class="skeleton-hero vo-skeleton"></div>
      }
      @default {
        <div class="skeleton-block vo-skeleton" [style.width]="width()" [style.height]="height()"></div>
      }
    }
  `,
  styles: [`
    .skeleton-card {
      width: 155px;
      flex-shrink: 0;

      &__image {
        width: 155px;
        height: 155px;
        border-radius: var(--vo-radius-md);
      }

      &__title {
        width: 80%;
        height: 14px;
        margin-top: 10px;
      }

      &__subtitle {
        width: 60%;
        height: 12px;
        margin-top: 6px;
      }
    }

    .skeleton-list {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;

      &__img {
        width: 44px;
        height: 44px;
        border-radius: var(--vo-radius-sm);
        flex-shrink: 0;
      }

      &__info {
        flex: 1;
      }

      &__title {
        width: 70%;
        height: 14px;
      }

      &__subtitle {
        width: 50%;
        height: 12px;
        margin-top: 6px;
      }
    }

    .skeleton-hero {
      width: 100%;
      height: 200px;
      border-radius: var(--vo-radius-lg);
    }

    .skeleton-block {
      border-radius: var(--vo-radius-sm);
    }

    @media (max-width: 576px) {
      .skeleton-card {
        width: 135px;

        &__image {
          width: 135px;
          height: 135px;
        }
      }
    }
  `],
})
export class SkeletonComponent {
  readonly type = input<'card' | 'list' | 'hero' | 'block'>('card');
  readonly width = input('100%');
  readonly height = input('20px');
}
