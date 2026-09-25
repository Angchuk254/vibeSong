// ============================================
// vibeOnly — Category Detail Component
// ============================================

import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { TrackCardComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, PlayerService } from '../../services';
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
          <h3 class="vo-section-title">
            <span>
              {{ category()!.group === 'radio' ? 'Stations' : 'Full songs' }}
              @if (!isLoading()) { <small class="cat-count">{{ fullSongs().length }}</small> }
            </span>
            @if (!isLoading() && fullSongs().length > 0) {
              <span class="cat-actions">
                <button class="vo-btn cat-shuffle" (click)="player.playAll(fullSongs(), true)"><i class="bi bi-shuffle"></i> Shuffle</button>
                <button class="vo-btn vo-btn-primary" (click)="player.playAll(fullSongs())"><i class="bi bi-play-fill"></i> Play</button>
              </span>
            }
          </h3>
          <div class="track-grid">
            @if (isLoading()) {
              @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
                <app-skeleton type="card"></app-skeleton>
              }
            } @else {
              @for (track of fullSongs(); track track.id) {
                <app-track-card [track]="track" [trackList]="fullSongs()"></app-track-card>
              }
            }
          </div>

          @if (!isLoading() && category()!.group !== 'radio') {
            <div class="add-own" [class.add-own--prominent]="fullSongs().length < 8">
              <i class="bi bi-phone"></i>
              <div>
                <strong>
                  @if (fullSongs().length === 0) { No full {{ category()!.name }} songs in the free catalogs yet }
                  @else { Have more {{ category()!.name }} songs? }
                </strong>
                <span>Add MP3s from your phone or computer — they play in full, stay on this device, and show up right here.</span>
              </div>
              <button class="vo-btn vo-btn-primary" (click)="addOwn()"><i class="bi bi-plus-lg"></i> Add your songs</button>
            </div>
          }
        </section>

        @if (!isLoading() && previews().length > 0) {
          <section class="cat-content">
            <h3 class="vo-section-title">
              <span>
                30-second previews <small class="cat-count">{{ previews().length }}</small>
                <small class="cat-hint">Only a short clip is free to stream. Open a song's <i class="bi bi-three-dots"></i> menu or the player for the full version on YouTube.</small>
              </span>
              <button class="vo-btn cat-shuffle" (click)="musicApi.setHidePreviews(true); reload()"><i class="bi bi-eye-slash"></i> Hide previews</button>
            </h3>
            <div class="track-grid">
              @for (track of previews(); track track.id) {
                <app-track-card [track]="track" [trackList]="previews()"></app-track-card>
              }
            </div>
          </section>
        } @else if (!isLoading() && musicApi.hidePreviews()) {
          <p class="cat-hint cat-hint--center">
            30-second previews are hidden.
            <button class="link-btn" (click)="musicApi.setHidePreviews(false); reload()">Show them</button>
          </p>
        }
      }
    </div>
  `,
  styles: [`
    .category-page {
      display: flex;
      flex-direction: column;
      gap: 32px;
      padding-bottom: 120px;
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

    .cat-count {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--vo-text-muted);
      margin-left: 6px;
    }

    .cat-actions {
      display: flex;
      gap: 8px;
    }

    .cat-shuffle {
      background: var(--vo-bg-input);
      color: var(--vo-text-primary);
    }

    .add-own {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 24px;
      padding: 16px 20px;
      border-radius: var(--vo-radius-lg);
      background: var(--vo-bg-card);
      border: 1px dashed var(--vo-border-light);

      > i { font-size: 1.8rem; color: var(--vo-accent-light); }
      div { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      strong { font-size: 0.95rem; }
      span { font-size: 0.82rem; color: var(--vo-text-secondary); }
      button { flex-shrink: 0; }

      &--prominent {
        border-style: solid;
        border-color: var(--vo-accent);
        background: linear-gradient(135deg, rgba(108, 92, 231, 0.18), var(--vo-bg-card));
      }
    }

    .cat-hint {
      display: block;
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--vo-text-muted);
      margin-top: 4px;
      max-width: 560px;

      &--center { text-align: center; }
    }

    .link-btn {
      background: none;
      border: none;
      color: var(--vo-accent-light);
      cursor: pointer;
      font-size: inherit;
    }

    @media (max-width: 576px) {
      .add-own { flex-direction: column; align-items: flex-start; }
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
  readonly musicApi = inject(MusicApiService);
  private router = inject(Router);
  readonly player = inject(PlayerService);
  private location = inject(Location);
  private destroy$ = new Subject<void>();

  category = signal<MusicCategory | null>(null);
  tracks = signal<Track[]>([]);
  isLoading = signal(true);
  readonly fullSongs = computed(() => this.tracks().filter((t) => !t.isPreview));
  readonly previews = computed(() => this.tracks().filter((t) => t.isPreview));

  reload(): void {
    const cat = this.category();
    if (cat) this.loadCategoryTracks(cat);
  }

  addOwn(): void {
    this.router.navigate(['/library'], { queryParams: { tab: 'device', cat: this.category()?.id } });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      if (id) {
        const cat = MUSIC_CATEGORIES.find(c => c.id === id);
        if (cat) {
          this.category.set(cat);
          this.loadCategoryTracks(cat);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCategoryTracks(cat: MusicCategory): void {
    this.isLoading.set(true);
    this.tracks.set([]);
    this.musicApi.getCategoryTracks(cat, 30)
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
