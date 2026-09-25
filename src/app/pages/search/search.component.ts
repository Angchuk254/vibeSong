// ============================================
// vibeOnly — Search Component
// ============================================

import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackListItemComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, PlayerService } from '../../services';
import { Track } from '../../models';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, catchError, map } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { MUSIC_CATEGORIES } from '../../core/categories.data';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, TrackListItemComponent, SkeletonComponent],
  template: `
    <div class="search-page vo-fade-in">
      <!-- Search Input -->
      <div class="search-box">
        <i class="bi bi-search search-icon"></i>
        <input type="text"
               #searchInput
               class="search-input"
               placeholder="Search songs, artists, genres, radio..."
               autocomplete="off"
               [value]="searchQuery()"
               (input)="onSearchInput($event)"
               />
        @if (searchQuery().length > 0) {
          <button class="clear-btn" (click)="clearSearch()">
            <i class="bi bi-x-circle-fill"></i>
          </button>
        }
      </div>

      <!-- Default View (Categories) -->
      @if (searchQuery().length === 0) {
        <section class="browse-section">
          <h3 class="vo-section-title">Browse All</h3>
          <div class="browse-grid">
            @for (cat of categories; track cat.id) {
              <div class="browse-card"
                   [style.background]="cat.gradient"
                   tabindex="0"
                   role="button"
                   (click)="goToCategory(cat.id)"
                   (keydown.enter)="goToCategory(cat.id)"
                   (keydown.space)="goToCategory(cat.id)">
                <h4>{{ cat.name }}</h4>
                <i class="bi" [ngClass]="cat.icon"></i>
              </div>
            }
          </div>
        </section>
      }

      <!-- Search Results -->
      @if (searchQuery().length > 0) {
        <section class="results-section">
          @if (isSearching()) {
            <div class="results-list">
              @for (i of [1,2,3,4,5,6]; track i) {
                <app-skeleton type="list"></app-skeleton>
              }
            </div>
          } @else if (searchResults().length > 0) {
            <div class="filter-chips">
              @for (f of filters; track f.id) {
                @if (f.id === 'all' || countFor(f.id) > 0) {
                  <button class="filter-chip" [class.active]="filter() === f.id" (click)="filter.set(f.id)">
                    {{ f.label }} @if (f.id !== 'all') { <small>{{ countFor(f.id) }}</small> }
                  </button>
                }
              }
            </div>

            @if ((filter() === 'all' || filter() === 'full') && fullSongs().length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">
                  Songs
                  <button class="vo-btn vo-btn-primary play-all" (click)="player.playAll(fullSongs())"><i class="bi bi-play-fill"></i> Play all</button>
                </h3>
                <div class="results-list">
                  @for (track of limit(fullSongs()); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="fullSongs()"></app-track-list-item>
                  }
                </div>
              </div>
            }

            @if ((filter() === 'all' || filter() === 'preview') && previews().length > 0) {
              <div class="results-group mt-4">
                <h3 class="vo-section-title">
                  <span>Previews <small class="group-hint">30-second clips of mainstream releases</small></span>
                </h3>
                <div class="results-list">
                  @for (track of limit(previews()); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="previews()"></app-track-list-item>
                  }
                </div>
              </div>
            }

            @if ((filter() === 'all' || filter() === 'radio') && stations().length > 0) {
              <div class="results-group mt-4">
                <h3 class="vo-section-title">Live Radio Stations</h3>
                <div class="results-list">
                  @for (track of limit(stations()); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="stations()"></app-track-list-item>
                  }
                </div>
              </div>
            }

          } @else {
            <div class="empty-state">
              <i class="bi bi-search"></i>
              <p>No results found for "{{ searchQuery() }}"</p>
              <span>Try a different keyword or genre</span>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .search-page {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .search-icon {
      position: absolute;
      left: 16px;
      color: var(--vo-text-muted);
      font-size: 1.2rem;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 56px;
      background: var(--vo-bg-card);
      border: 1px solid var(--vo-border);
      border-radius: var(--vo-radius-xl);
      padding: 0 48px 0 48px;
      font-size: 1.1rem;
      color: var(--vo-text-primary);
      font-family: var(--vo-font-primary);
      transition: all var(--vo-transition);
      outline: none;

      &::placeholder {
        color: var(--vo-text-muted);
      }

      &:focus {
        border-color: var(--vo-accent);
        box-shadow: 0 0 0 4px var(--vo-accent-glow);
        background: var(--vo-bg-card-hover);
      }
    }

    .clear-btn {
      position: absolute;
      right: 16px;
      background: none;
      border: none;
      color: var(--vo-text-muted);
      font-size: 1.2rem;
      cursor: pointer;
      padding: 0;

      &:hover {
        color: var(--vo-text-primary);
      }
    }

    .browse-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      @media (min-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (min-width: 1024px) {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .browse-card {
      position: relative;
      border-radius: var(--vo-radius-lg);
      padding: 20px;
      height: 120px;
      overflow: hidden;
      cursor: pointer;
      transition: transform var(--vo-transition);

      &:hover {
        transform: scale(1.03);
      }

      h4 {
        color: #fff;
        font-size: 1.1rem;
        font-weight: 700;
        margin: 0;
        position: relative;
        z-index: 2;
      }

      i {
        position: absolute;
        bottom: -10px;
        right: -10px;
        font-size: 5rem;
        color: rgba(255, 255, 255, 0.2);
        transform: rotate(15deg);
        z-index: 1;
      }
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }

    .filter-chip {
      border: 1px solid var(--vo-border-light);
      background: var(--vo-bg-input);
      color: var(--vo-text-primary);
      border-radius: var(--vo-radius-xl);
      padding: 6px 14px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;

      small {
        color: var(--vo-text-muted);
        font-weight: 500;
        margin-left: 4px;
      }

      &.active {
        background: var(--vo-text-primary);
        color: var(--vo-bg-primary);

        small { color: inherit; opacity: 0.7; }
      }
    }

    .play-all {
      padding: 6px 16px;
      font-size: 0.8rem;
    }

    .group-hint {
      display: block;
      font-size: 0.72rem;
      font-weight: 400;
      color: var(--vo-text-muted);
    }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: var(--vo-text-muted);

      i {
        font-size: 3rem;
        margin-bottom: 16px;
        color: var(--vo-border);
      }

      p {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--vo-text-primary);
        margin: 0 0 8px;
      }

      span {
        font-size: 0.9rem;
      }
    }
  `]
})
export class SearchComponent implements OnDestroy {
  private musicApi = inject(MusicApiService);
  readonly player = inject(PlayerService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  searchQuery = signal('');
  searchResults = signal<Track[]>([]);
  isSearching = signal(false);
  categories = MUSIC_CATEGORIES;

  constructor() {
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(400),
      distinctUntilChanged(),
      tap(query => {
        this.searchQuery.set(query);
        if (query.trim().length === 0) {
          this.searchResults.set([]);
          this.isSearching.set(false);
        } else {
          this.isSearching.set(true);
        }
      }),
      switchMap(query => {
        if (query.trim().length === 0) return of([] as Track[]);
        return forkJoin([
          this.musicApi.searchTracks(query, 25).pipe(catchError(() => of([] as Track[]))),
          this.musicApi.searchStations(query, 10).pipe(catchError(() => of([] as Track[]))),
        ]).pipe(map(([songs, stations]) => [...songs, ...stations]));
      })
    ).subscribe(results => {
      this.filter.set('all');
      this.searchResults.set(results);
      this.isSearching.set(false);
    });

    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.searchQuery.set(q);
      this.searchSubject.next(q);
    }
  }

  readonly filters: { id: 'all' | 'full' | 'preview' | 'radio'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'full', label: 'Full songs' },
    { id: 'preview', label: 'Previews' },
    { id: 'radio', label: 'Radio' },
  ];
  readonly filter = signal<'all' | 'full' | 'preview' | 'radio'>('all');

  readonly fullSongs = computed(() => this.searchResults().filter(t => !t.isPreview && !this.isRadio(t)));
  readonly previews = computed(() => this.searchResults().filter(t => t.isPreview));
  readonly stations = computed(() => this.searchResults().filter(t => this.isRadio(t)));

  countFor(id: 'all' | 'full' | 'preview' | 'radio'): number {
    if (id === 'full') return this.fullSongs().length;
    if (id === 'preview') return this.previews().length;
    if (id === 'radio') return this.stations().length;
    return this.searchResults().length;
  }

  /** In the "All" view keep each group short; a filter shows everything */
  limit(tracks: Track[]): Track[] {
    return this.filter() === 'all' ? tracks.slice(0, 8) : tracks;
  }

  private isRadio(t: Track): boolean {
    return !!t.isLive || t.provider === 'radio';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchSubject.next(target.value);
  }

  clearSearch(): void {
    this.searchSubject.next('');
    this.searchQuery.set('');
  }

  goToCategory(id: string): void {
    this.router.navigate(['/category', id]);
  }
}
