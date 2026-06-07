// ============================================
// vibeOnly — Search Component
// ============================================

import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackListItemComponent, SkeletonComponent } from '../../shared';
import { MusicApiService } from '../../services';
import { Track } from '../../models';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MUSIC_CATEGORIES } from '../../core/categories.data';
import { Router } from '@angular/router';

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
               placeholder="Search tracks, artists, vibes..."
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
            
            @if (getTracksOnly().length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">Songs</h3>
                <div class="results-list">
                  @for (track of getTracksOnly(); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="getTracksOnly()"></app-track-list-item>
                  }
                </div>
              </div>
            }

            @if (getRadioOnly().length > 0) {
              <div class="results-group mt-4">
                <h3 class="vo-section-title">Live Radio Stations</h3>
                <div class="results-list">
                  @for (track of getRadioOnly(); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="getRadioOnly()"></app-track-list-item>
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
  private router = inject(Router);
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
        if (query.trim().length === 0) return of([]);
        return this.musicApi.searchTracks(query).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(results => {
      this.searchResults.set(results);
      this.isSearching.set(false);
    });
  }

  getTracksOnly(): Track[] {
    return this.searchResults().filter(t => t.provider !== 'radio');
  }

  getRadioOnly(): Track[] {
    return this.searchResults().filter(t => t.provider === 'radio');
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
