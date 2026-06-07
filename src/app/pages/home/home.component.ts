// ============================================
// vibeOnly — Home Page Component
// ============================================

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TrackCardComponent, TrackListItemComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, StorageService } from '../../services';
import { RadioProvider } from '../../core/providers/radio.provider';
import { ArchiveProvider } from '../../core/providers/archive.provider';
import { Track, MusicCategory } from '../../models';
import { MUSIC_CATEGORIES } from '../../core/categories.data';
import { Subject, takeUntil, finalize } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, TrackListItemComponent, SkeletonComponent],
  template: `
    <div class="home vo-fade-in">
      <!-- Header -->
      <header class="home__header">
        <div>
          <h2 class="home__greeting">{{ greeting() }}</h2>
          <p class="home__subtitle">Discover Himalayan & Global Vibes</p>
        </div>
      </header>

      <!-- Categories -->
      <section class="home__section">
        <div class="vo-hscroll">
          @for (cat of categories; track cat.id) {
            <button class="category-pill"
                    [style.background]="cat.gradient"
                    (click)="goToCategory(cat)">
              <i class="bi" [ngClass]="cat.icon"></i>
              <span>{{ cat.name }}</span>
            </button>
          }
        </div>
      </section>

      <!-- Recent Plays -->
      @if (recentTracks().length > 0) {
        <section class="home__section">
          <h3 class="vo-section-title">
            Recently Played
            <span class="vo-see-all" (click)="goToLibrary()">Library</span>
          </h3>
          <div class="recent-grid">
            @for (track of recentTracks().slice(0, 4); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="recentTracks()"></app-track-list-item>
            }
          </div>
        </section>
      }

      <!-- Trending -->
      <section class="home__section">
        <h3 class="vo-section-title">Trending Now</h3>
        <div class="vo-hscroll">
          @if (isLoadingTrending()) {
            @for (i of [1,2,3,4,5]; track i) {
              <app-skeleton type="card"></app-skeleton>
            }
          } @else {
            @for (track of trendingTracks(); track track.id) {
              <app-track-card [track]="track" [trackList]="trendingTracks()"></app-track-card>
            }
            @if (trendingTracks().length === 0) {
              <p class="empty-state">No trending tracks found.</p>
            }
          }
        </div>
      </section>

      <!-- Regional & Mood Radio Sections -->
      @for (region of regionalRadios(); track region.id) {
        @if (region.loading || region.tracks.length > 0) {
          <section class="home__section">
            <h3 class="vo-section-title">
              {{ region.title }} 
              <i class="bi" [ngClass]="region.icon"></i>
            </h3>
            <div class="vo-hscroll">
              @if (region.loading) {
                @for (i of [1,2,3,4,5]; track i) {
                  <app-skeleton type="card"></app-skeleton>
                }
              } @else {
                @for (track of region.tracks; track track.id) {
                  <app-track-card [track]="track" [trackList]="region.tracks"></app-track-card>
                }
              }
            </div>
          </section>
        }
      }

      <!-- Free Music Archive -->
      <section class="home__section">
        <h3 class="vo-section-title">
          Free Archives
          <i class="bi bi-bank2"></i>
        </h3>
        <div class="vo-hscroll">
          @if (isLoadingArchive()) {
            @for (i of [1,2,3,4,5]; track i) {
              <app-skeleton type="card"></app-skeleton>
            }
          } @else {
            @for (track of archiveTracks(); track track.id) {
              <app-track-card [track]="track" [trackList]="archiveTracks()"></app-track-card>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home {
      display: flex;
      flex-direction: column;
      gap: 32px;
      padding-bottom: 120px;
    }

    .home__header {
      margin-bottom: 8px;
    }

    .home__greeting {
      font-size: 1.8rem;
      font-weight: 800;
      margin: 0;
      color: var(--vo-text-primary);
    }

    .home__subtitle {
      font-size: 0.95rem;
      color: var(--vo-text-secondary);
      margin: 4px 0 0;
    }

    .home__section {
      display: flex;
      flex-direction: column;
    }

    /* Category Pills */
    .category-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: var(--vo-radius-xl);
      border: none;
      color: #fff;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: transform var(--vo-transition-fast), box-shadow var(--vo-transition-fast);
      white-space: nowrap;

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--vo-shadow-sm);
      }

      i {
        font-size: 1.1rem;
      }
    }

    /* Recent Grid */
    .recent-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    @media (min-width: 768px) {
      .recent-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }

    .empty-state {
      color: var(--vo-text-muted);
      font-size: 0.9rem;
      padding: 20px 0;
    }
  `],
})
export class HomeComponent implements OnInit, OnDestroy {
  private musicApi = inject(MusicApiService);
  private storage = inject(StorageService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  private radioApi = inject(RadioProvider);
  private archiveApi = inject(ArchiveProvider);

  categories = MUSIC_CATEGORIES;
  recentTracks = signal<Track[]>([]);

  trendingTracks = signal<Track[]>([]);
  isLoadingTrending = signal(true);

  archiveTracks = signal<Track[]>([]);
  isLoadingArchive = signal(true);

  regionalRadios = signal<any[]>([
    { id: 'bollywood', title: 'Bollywood Hits', icon: 'bi-film', tracks: [], loading: true },
    { id: 'lofi', title: 'Lofi Chill', icon: 'bi-cup-hot-fill', tracks: [], loading: true },
    { id: 'zen', title: 'Meditation & Zen', icon: 'bi-flower1', tracks: [], loading: true },
    { id: 'jazz', title: 'Smooth Jazz', icon: 'bi-sax-fill', tracks: [], loading: true },
    { id: 'hindi', title: 'Hindi Radio', icon: 'bi-translate', tracks: [], loading: true },
    { id: 'punjabi', title: 'Punjabi Radio', icon: 'bi-music-player-fill', tracks: [], loading: true },
    { id: 'ladakhi', title: 'Ladakhi Radio', icon: 'bi-snow2', tracks: [], loading: true },
    { id: 'tibet', title: 'Tibetan & Buddhist', icon: 'bi-flower3', tracks: [], loading: true },
    { id: 'nepal', title: 'Nepali', icon: 'bi-geo-alt-fill', tracks: [], loading: true },
    { id: '80s', title: 'Retro 80s', icon: 'bi-controller', tracks: [], loading: true },
    { id: 'classical', title: 'Classical', icon: 'bi-vector-pen', tracks: [], loading: true }
  ]);

  greeting = signal('Good evening');

  ngOnInit(): void {
    this.updateGreeting();
    this.loadRecent();
    this.loadTrending();
    this.loadRegionalRadios();
    this.loadArchiveTracks();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateGreeting(): void {
    const hour = new Date().getHours();
    if (hour < 12) this.greeting.set('Good morning');
    else if (hour < 18) this.greeting.set('Good afternoon');
    else this.greeting.set('Good evening');
  }

  private loadRecent(): void {
    this.recentTracks.set(this.storage.getRecentTracks());
  }

  private loadTrending(): void {
    this.musicApi.getTrendingTracks(10)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingTrending.set(false))
      )
      .subscribe({
        next: (tracks) => this.trendingTracks.set(tracks),
        error: (err) => console.error('Failed to load trending:', err)
      });
  }

  private loadArchiveTracks(): void {
    this.archiveApi.getFeaturedTracks(10)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingArchive.set(false))
      )
      .subscribe({
        next: (tracks) => this.archiveTracks.set(tracks),
        error: (err) => console.error('Failed to load archive tracks:', err)
      });
  }

  private loadRegionalRadios(): void {
    const regions = this.regionalRadios();
    regions.forEach((region, index) => {
      this.radioApi.getRegionalTracks(region.id, 8)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            const current = this.regionalRadios();
            current[index].loading = false;
            this.regionalRadios.set([...current]);
          })
        )
        .subscribe({
          next: (tracks) => {
            const current = this.regionalRadios();
            current[index].tracks = tracks;
            this.regionalRadios.set([...current]);
          },
          error: (err) => console.error(`Failed to load ${region.title} radio:`, err)
        });
    });
  }

  goToCategory(cat: MusicCategory): void {
    this.router.navigate(['/category', cat.id]);
  }

  goToLibrary(): void {
    this.router.navigate(['/library']);
  }
}
