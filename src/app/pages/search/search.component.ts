// ============================================
// YakBeats — Search Component
// ============================================

import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, catchError, map } from 'rxjs/operators';
import {
  TrackListItemComponent, SkeletonComponent, ArtistCardComponent, CollectionCardComponent,
} from '../../shared';
import { MusicApiService, PlayerService, StorageService } from '../../services';
import { Track, ArtistSummary, Collection } from '../../models';
import { MUSIC_CATEGORIES, CATEGORY_GROUPS } from '../../core/categories.data';

type Filter = 'all' | 'full' | 'preview' | 'artists' | 'playlists' | 'radio';

interface Results {
  songs: Track[];
  stations: Track[];
  artists: ArtistSummary[];
  playlists: Collection[];
}

const EMPTY: Results = { songs: [], stations: [], artists: [], playlists: [] };

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, TrackListItemComponent, SkeletonComponent, ArtistCardComponent, CollectionCardComponent],
  template: `
    <div class="search-page vo-fade-in">
      <!-- Search Input -->
      <div class="search-box">
        <i class="bi bi-search search-icon"></i>
        <input type="text"
               class="search-input"
               placeholder="What do you want to listen to?"
               autocomplete="off"
               aria-label="Search"
               [value]="searchQuery()"
               (input)="onSearchInput($event)"
               (keydown.enter)="commitSearch()" />
        @if (searchQuery().length > 0) {
          <button class="clear-btn" (click)="clearSearch()" aria-label="Clear search">
            <i class="bi bi-x-circle-fill"></i>
          </button>
        }
      </div>

      <!-- Default View -->
      @if (searchQuery().length === 0) {
        @if (recentSearches().length > 0) {
          <section>
            <h3 class="vo-section-title">
              Recent searches
              <button class="link-btn" (click)="clearRecentSearches()">Clear</button>
            </h3>
            <div class="chips">
              @for (q of recentSearches(); track q) {
                <button class="chip" (click)="searchFor(q)"><i class="bi bi-clock-history"></i> {{ q }}</button>
              }
            </div>
          </section>
        }

        @for (group of groups; track group.id) {
          <section class="browse-section">
            <h3 class="vo-section-title">{{ group.title }}</h3>
            <div class="browse-grid">
              @for (cat of categoriesIn(group.id); track cat.id) {
                <div class="browse-card"
                     [style.background]="cat.gradient"
                     tabindex="0"
                     role="button"
                     (click)="goToCategory(cat.id)"
                     (keydown.enter)="goToCategory(cat.id)">
                  <h4>{{ cat.name }}</h4>
                  <i class="bi" [ngClass]="cat.icon"></i>
                </div>
              }
            </div>
          </section>
        }
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
          } @else if (total() > 0) {
            <div class="chips filter-chips">
              @for (f of filters; track f.id) {
                @if (f.id === 'all' || countFor(f.id) > 0) {
                  <button class="chip" [class.active]="filter() === f.id" (click)="filter.set(f.id)">
                    {{ f.label }} @if (f.id !== 'all') { <small>{{ countFor(f.id) }}</small> }
                  </button>
                }
              }
            </div>

            @if (filter() === 'all') {
              <div class="top-row">
                @if (topResult(); as top) {
                  <div class="top-result" tabindex="0" role="button"
                       (click)="player.playTrack(top, fullSongs().length ? fullSongs() : previews())"
                       (keydown.enter)="player.playTrack(top, fullSongs().length ? fullSongs() : previews())">
                    <h3 class="vo-section-title">Top result</h3>
                    <img [src]="top.album_image || top.image || 'icons/icon-192x192.png'" alt="" />
                    <h2>{{ top.name }}</h2>
                    <p>
                      @if (top.isPreview) { <span class="vo-badge">PREVIEW</span> }
                      Song · {{ top.artist_name }}
                    </p>
                    <span class="top-result__play"><i class="bi bi-play-fill"></i></span>
                  </div>
                }
                <div class="top-songs">
                  <h3 class="vo-section-title">Songs</h3>
                  <div class="results-list">
                    @for (track of fullSongs().slice(0, 5); track track.id; let i = $index) {
                      <app-track-list-item [track]="track" [index]="i + 1" [trackList]="fullSongs()"></app-track-list-item>
                    }
                  </div>
                </div>
              </div>
            }

            @if ((filter() === 'all' || filter() === 'artists') && results().artists.length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">Artists</h3>
                <div [class.vo-hscroll]="filter() === 'all'" [class.card-grid]="filter() !== 'all'">
                  @for (a of results().artists; track a.ref) {
                    <app-artist-card [artist]="a"></app-artist-card>
                  }
                </div>
              </div>
            }

            @if ((filter() === 'all' || filter() === 'playlists') && results().playlists.length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">Playlists & Albums</h3>
                <div [class.vo-hscroll]="filter() === 'all'" [class.card-grid]="filter() !== 'all'">
                  @for (c of results().playlists; track c.ref) {
                    <app-collection-card [collection]="c"></app-collection-card>
                  }
                </div>
              </div>
            }

            @if (filter() === 'full' && fullSongs().length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">
                  Songs
                  <button class="vo-btn vo-btn-primary play-all" (click)="player.playAll(fullSongs())"><i class="bi bi-play-fill"></i> Play all</button>
                </h3>
                <div class="results-list">
                  @for (track of fullSongs(); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="fullSongs()"></app-track-list-item>
                  }
                </div>
              </div>
            }

            @if ((filter() === 'all' || filter() === 'preview') && previews().length > 0) {
              <div class="results-group">
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

            @if ((filter() === 'all' || filter() === 'radio') && results().stations.length > 0) {
              <div class="results-group">
                <h3 class="vo-section-title">Live Radio Stations</h3>
                <div class="results-list">
                  @for (track of limit(results().stations); track track.id; let i = $index) {
                    <app-track-list-item [track]="track" [index]="i + 1" [trackList]="results().stations"></app-track-list-item>
                  }
                </div>
              </div>
            }
          } @else {
            <div class="empty-state">
              <i class="bi bi-search"></i>
              <p>No results found for "{{ searchQuery() }}"</p>
              <span>Check the spelling, or try an artist, genre or language</span>
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
      padding-bottom: 120px;
    }

    .search-box {
      position: sticky;
      top: calc(8px + env(safe-area-inset-top, 0px));
      z-index: 20;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 640px;
    }

    .search-icon {
      position: absolute;
      left: 18px;
      color: var(--vo-text-muted);
      font-size: 1.2rem;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 54px;
      background: var(--vo-bg-card);
      border: 1px solid var(--vo-border);
      border-radius: var(--vo-radius-xl);
      padding: 0 48px 0 50px;
      font-size: 1.05rem;
      color: var(--vo-text-primary);
      font-family: var(--vo-font-primary);
      transition: all var(--vo-transition);
      outline: none;
      box-shadow: var(--vo-shadow-md);

      &::placeholder {
        color: var(--vo-text-muted);
      }

      &:focus {
        border-color: var(--vo-accent);
        box-shadow: 0 0 0 4px var(--vo-accent-glow);
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

    .link-btn {
      background: none;
      border: none;
      color: var(--vo-text-muted);
      font-size: 0.85rem;
      cursor: pointer;

      &:hover { color: var(--vo-text-primary); }
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--vo-border-light);
      background: var(--vo-bg-input);
      color: var(--vo-text-primary);
      border-radius: var(--vo-radius-xl);
      padding: 6px 14px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;

      i { color: var(--vo-text-muted); }

      small {
        color: var(--vo-text-muted);
        font-weight: 500;
      }

      &.active {
        background: var(--vo-text-primary);
        color: var(--vo-bg-primary);

        small { color: inherit; opacity: 0.7; }
      }
    }

    .filter-chips {
      margin-bottom: 4px;
    }

    .browse-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;

      @media (min-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
      }
      @media (min-width: 1024px) {
        grid-template-columns: repeat(5, 1fr);
      }
    }

    .browse-card {
      position: relative;
      border-radius: var(--vo-radius-md);
      padding: 16px;
      height: 104px;
      overflow: hidden;
      cursor: pointer;
      transition: transform var(--vo-transition);

      &:hover {
        transform: scale(1.03);
      }

      h4 {
        color: #fff;
        font-size: 1rem;
        font-weight: 800;
        margin: 0;
        position: relative;
        z-index: 2;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        max-width: 80%;
      }

      i {
        position: absolute;
        bottom: -10px;
        right: -8px;
        font-size: 4.2rem;
        color: rgba(255, 255, 255, 0.28);
        transform: rotate(18deg);
        z-index: 1;
      }
    }

    .top-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;

      > * { min-width: 0; }

      @media (min-width: 992px) {
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      }
    }

    .top-result {
      position: relative;
      padding: 20px;
      border-radius: var(--vo-radius-lg);
      background: var(--vo-bg-card);
      cursor: pointer;
      transition: background var(--vo-transition-fast);

      &:hover {
        background: var(--vo-bg-card-hover);

        .top-result__play { opacity: 1; transform: none; }
      }

      img {
        width: 96px;
        height: 96px;
        border-radius: var(--vo-radius-md);
        object-fit: cover;
        box-shadow: var(--vo-shadow-md);
      }

      h2 {
        font-size: 1.8rem;
        font-weight: 900;
        margin: 16px 0 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      p {
        margin: 0;
        color: var(--vo-text-secondary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .top-result__play {
      position: absolute;
      right: 20px;
      bottom: 20px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--vo-accent);
      color: #fff;
      font-size: 1.7rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--vo-shadow-md);
      opacity: 0;
      transform: translateY(8px);
      transition: all var(--vo-transition);
    }

    .results-group {
      margin-top: 28px;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
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
      gap: 6px;
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

    @media (hover: none) {
      .top-result__play { opacity: 1; transform: none; }
    }
  `]
})
export class SearchComponent implements OnDestroy {
  private musicApi = inject(MusicApiService);
  readonly player = inject(PlayerService);
  private storage = inject(StorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  readonly groups = CATEGORY_GROUPS;
  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'full', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'preview', label: 'Previews' },
    { id: 'radio', label: 'Radio' },
  ];

  searchQuery = signal('');
  results = signal<Results>(EMPTY);
  isSearching = signal(false);
  filter = signal<Filter>('all');
  recentSearches = signal<string[]>(this.storage.getRecentSearches());

  readonly fullSongs = computed(() => this.results().songs.filter(t => !t.isPreview && !t.isLive && t.provider !== 'radio'));
  readonly previews = computed(() => this.results().songs.filter(t => t.isPreview));
  readonly topResult = computed(() => this.fullSongs()[0] || this.previews()[0] || null);
  readonly total = computed(() => {
    const r = this.results();
    return r.songs.length + r.stations.length + r.artists.length + r.playlists.length;
  });

  constructor() {
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(350),
      distinctUntilChanged(),
      tap(query => {
        this.searchQuery.set(query);
        this.isSearching.set(query.trim().length > 0);
        if (!query.trim()) this.results.set(EMPTY);
      }),
      switchMap(query => {
        if (query.trim().length === 0) return of(EMPTY);
        return forkJoin({
          songs: this.musicApi.searchTracks(query, 25).pipe(catchError(() => of([] as Track[]))),
          stations: this.musicApi.searchStations(query, 10).pipe(catchError(() => of([] as Track[]))),
          artists: this.musicApi.searchArtists(query, 10),
          playlists: this.musicApi.searchPlaylists(query, 10),
        }).pipe(map((r): Results => r));
      })
    ).subscribe(results => {
      this.filter.set('all');
      this.results.set(results);
      this.isSearching.set(false);
      if (this.total() > 0) this.commitSearch();
    });

    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.searchFor(q);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  categoriesIn(group: string) {
    return MUSIC_CATEGORIES.filter(c => c.group === group);
  }

  countFor(id: Filter): number {
    const r = this.results();
    switch (id) {
      case 'full': return this.fullSongs().length;
      case 'preview': return this.previews().length;
      case 'radio': return r.stations.length;
      case 'artists': return r.artists.length;
      case 'playlists': return r.playlists.length;
      default: return this.total();
    }
  }

  /** In the "All" view keep each group short; a filter shows everything */
  limit(tracks: Track[]): Track[] {
    return this.filter() === 'all' ? tracks.slice(0, 6) : tracks;
  }

  onSearchInput(event: Event): void {
    this.searchSubject.next((event.target as HTMLInputElement).value);
  }

  searchFor(q: string): void {
    this.searchQuery.set(q);
    this.searchSubject.next(q);
  }

  commitSearch(): void {
    this.storage.addRecentSearch(this.searchQuery());
    this.recentSearches.set(this.storage.getRecentSearches());
  }

  clearSearch(): void {
    this.searchSubject.next('');
    this.searchQuery.set('');
    this.recentSearches.set(this.storage.getRecentSearches());
  }

  clearRecentSearches(): void {
    this.storage.clearRecentSearches();
    this.recentSearches.set([]);
  }

  goToCategory(id: string): void {
    this.router.navigate(['/category', id]);
  }
}
