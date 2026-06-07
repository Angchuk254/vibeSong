// ============================================
// vibeOnly — Category Detail Component
// ============================================

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TrackCardComponent, SkeletonComponent } from '../../shared';
import { MusicApiService } from '../../services';
import { Track, MusicCategory } from '../../models';
import { MUSIC_CATEGORIES } from '../../core/categories.data';

@Component({
  selector: 'app-category',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, SkeletonComponent],
  template: `
    <div class="category-page vo-fade-in">
      @if (category()) {
        <header class="cat-header" [style.background]="category()?.gradient">
          <button class="back-btn" (click)="goBack()" aria-label="Go Back">
            <i class="bi bi-chevron-left"></i>
          </button>
          
          <div class="cat-header__content">
            <div class="icon-wrapper">
              <i class="bi" [ngClass]="category()!.icon"></i>
            </div>
            <div class="text-wrapper">
              <h1 class="cat-header__title">{{ category()?.name }}</h1>
              <p class="cat-header__desc">{{ category()?.description }}</p>
            </div>
          </div>
        </header>

        <section class="cat-content">
          <h3 class="vo-section-title">Top Tracks</h3>
          <div class="track-grid">
            @if (isLoading()) {
              @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                <app-skeleton type="card"></app-skeleton>
              }
            } @else {
              @for (track of tracks(); track track.id) {
                <app-track-card [track]="track" [trackList]="tracks()"></app-track-card>
              }
              @if (tracks().length === 0) {
                <div class="empty-state">No tracks found for this category.</div>
              }
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .category-page {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .cat-header {
      padding: 60px 24px 40px;
      border-radius: var(--vo-radius-lg);
      color: #fff;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      position: relative;
      overflow: hidden;
      margin-top: 10px;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at top right, rgba(255,255,255,0.2), transparent);
        z-index: 0;
      }
    }

    .back-btn {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
      transition: all 0.2s;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);

      &:hover {
        background: rgba(0, 0, 0, 0.6);
        transform: scale(1.05);
      }
      
      i { 
        font-size: 1rem;
        margin-right: 2px; /* Visual center adjustment */
      }
    }

    .cat-header__content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 24px;

      .icon-wrapper {
        width: 100px;
        height: 100px;
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(5px);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        
        i {
          font-size: 3.5rem;
          opacity: 1;
        }
      }
    }

    .cat-header__title {
      font-size: 2.8rem;
      font-weight: 900;
      margin: 0 0 4px;
      letter-spacing: -0.5px;
    }

    .cat-header__desc {
      font-size: 1.1rem;
      margin: 0;
      opacity: 0.9;
      max-width: 500px;
      font-weight: 500;
      line-height: 1.4;
    }

    .track-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      justify-items: center;
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px;
      color: var(--vo-text-muted);
    }

    @media (max-width: 576px) {
      .cat-header {
        padding: 24px 16px;
      }
      .cat-header__content i {
        font-size: 2.5rem;
      }
      .cat-header__title {
        font-size: 1.8rem;
      }
      .track-grid {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 12px;
      }
    }
  `]
})
export class CategoryComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private musicApi = inject(MusicApiService);
  private location = inject(Location);
  private destroy$ = new Subject<void>();

  category = signal<MusicCategory | null>(null);
  tracks = signal<Track[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        const cat = MUSIC_CATEGORIES.find(c => c.id === id);
        if (cat) {
          this.category.set(cat);
          this.loadCategoryTracks(cat.tag);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCategoryTracks(tag: string): void {
    this.isLoading.set(true);
    this.musicApi.getTracksByTag(tag, 30)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => this.tracks.set(res),
        error: (err) => console.error('Failed to load category', err)
      });
  }

  goBack(): void {
    this.location.back();
  }
}
