// ============================================
// vibeOnly — Home Page Component
// ============================================

import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TrackCardComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, StorageService, PlayerService } from '../../services';
import { Track, MusicCategory } from '../../models';
import { MUSIC_CATEGORIES } from '../../core/categories.data';
import { Observable, Subject, of, takeUntil, finalize } from 'rxjs';

interface Row {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  tracks: Track[];
  loading: boolean;
  load: () => Observable<Track[]>;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, SkeletonComponent],
  template: `
    <div class="home vo-fade-in">
      <!-- Header -->
      <header class="home__header">
        <div>
          <h2 class="home__greeting">{{ greeting() }}</h2>
          <p class="home__subtitle">Full-length songs, your uploads, and live radio — all in one place</p>
        </div>
        <button class="home__refresh" (click)="refresh()" aria-label="Refresh" title="Refresh">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
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

      <!-- Quick picks: liked + recent -->
      @if (recentTracks().length > 0 || likedCount() > 0) {
        <section class="home__section">
          <div class="quick-grid">
            @if (likedCount() > 0) {
              <button class="quick-tile" (click)="playLiked()">
                <span class="quick-tile__art quick-tile__art--liked"><i class="bi bi-heart-fill"></i></span>
                <span class="quick-tile__name">Liked Songs<small>{{ likedCount() }} songs</small></span>
                <i class="bi bi-play-circle-fill quick-tile__play"></i>
              </button>
            }
            @for (track of recentTracks().slice(0, likedCount() > 0 ? 5 : 6); track track.id) {
              <button class="quick-tile" (click)="player.playTrack(track, recentTracks())">
                <img class="quick-tile__art" [src]="track.album_image || track.image || 'icons/icon-192x192.png'" alt="" loading="lazy" />
                <span class="quick-tile__name">{{ track.name }}<small>{{ track.artist_name }}</small></span>
                <i class="bi bi-play-circle-fill quick-tile__play"></i>
              </button>
            }
          </div>
        </section>
      }

      @for (row of rows(); track row.id) {
        @if (row.loading || row.tracks.length > 0) {
          <section class="home__section">
            <h3 class="vo-section-title">
              <span class="row-title">
                <i class="bi" [ngClass]="row.icon"></i>
                <span>
                  {{ row.title }}
                  @if (row.subtitle) { <small>{{ row.subtitle }}</small> }
                </span>
              </span>
              @if (!row.loading && row.tracks.length > 1) {
                <span class="row-actions">
                  <button class="row-btn" (click)="player.playAll(row.tracks, true)" aria-label="Shuffle play" title="Shuffle play">
                    <i class="bi bi-shuffle"></i>
                  </button>
                  <button class="row-btn row-btn--play" (click)="player.playAll(row.tracks)" aria-label="Play all" title="Play all">
                    <i class="bi bi-play-fill"></i>
                  </button>
                </span>
              }
            </h3>
            <div class="vo-hscroll">
              @if (row.loading) {
                @for (i of [1,2,3,4,5]; track i) {
                  <app-skeleton type="card"></app-skeleton>
                }
              } @else {
                @for (track of row.tracks; track track.id) {
                  <app-track-card [track]="track" [trackList]="row.tracks"></app-track-card>
                }
              }
            </div>
          </section>
        }
      }

      @if (allEmpty()) {
        <div class="empty-state">
          <i class="bi bi-wifi-off"></i>
          <p>Couldn't reach any music source.</p>
          <button class="vo-btn vo-btn-primary" (click)="refresh()">Try again</button>
        </div>
      }
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
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
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

    .home__refresh {
      background: var(--vo-bg-input);
      border: none;
      color: var(--vo-text-secondary);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex-shrink: 0;
      cursor: pointer;
      font-size: 1.1rem;

      &:hover { color: var(--vo-text-primary); }
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
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--vo-shadow-sm);
      }

      i {
        font-size: 1.1rem;
      }
    }

    /* Quick picks */
    .quick-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    @media (min-width: 992px) {
      .quick-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
    }

    .quick-tile {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 56px;
      padding: 0 10px 0 0;
      border: none;
      border-radius: var(--vo-radius-sm);
      background: var(--vo-bg-card);
      color: var(--vo-text-primary);
      text-align: left;
      overflow: hidden;
      cursor: pointer;
      transition: background var(--vo-transition-fast);

      &:hover {
        background: var(--vo-bg-card-hover);

        .quick-tile__play { opacity: 1; }
      }
    }

    .quick-tile__art {
      width: 56px;
      height: 56px;
      object-fit: cover;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      &--liked {
        background: linear-gradient(135deg, #4a00e0, #8e2de2);
        color: #fff;
        font-size: 1.3rem;
      }
    }

    .quick-tile__name {
      flex: 1;
      min-width: 0;
      font-size: 0.82rem;
      font-weight: 700;
      display: flex;
      flex-direction: column;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      small {
        font-weight: 400;
        font-size: 0.72rem;
        color: var(--vo-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .quick-tile__play {
      font-size: 1.6rem;
      color: var(--vo-accent);
      opacity: 0;
      transition: opacity var(--vo-transition-fast);
    }

    /* Row header */
    .row-title {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;

      i {
        color: var(--vo-accent-light);
      }

      small {
        display: block;
        font-size: 0.72rem;
        font-weight: 400;
        color: var(--vo-text-muted);
        margin-top: 2px;
      }
    }

    .row-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .row-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      background: var(--vo-bg-input);
      color: var(--vo-text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover { color: var(--vo-text-primary); }

      &--play {
        background: var(--vo-accent);
        color: #fff;
        font-size: 1.1rem;

        &:hover { color: #fff; background: var(--vo-accent-light); }
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: var(--vo-text-muted);
      padding: 40px 0;

      i { font-size: 2.5rem; }
      p { margin: 0; }
    }
  `],
})
export class HomeComponent implements OnInit, OnDestroy {
  private musicApi = inject(MusicApiService);
  private storage = inject(StorageService);
  readonly player = inject(PlayerService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  categories = MUSIC_CATEGORIES;
  recentTracks = signal<Track[]>([]);
  likedCount = signal(0);
  greeting = signal('Good evening');
  rows = signal<Row[]>([]);

  ngOnInit(): void {
    this.updateGreeting();
    this.loadPersonal();
    this.rows.set(this.buildRows());
    this.loadRows();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  allEmpty(): boolean {
    const rows = this.rows();
    return rows.length > 0 && rows.every((r) => !r.loading && r.tracks.length === 0);
  }

  refresh(): void {
    this.musicApi.clearCache();
    this.loadPersonal();
    this.rows.set(this.buildRows());
    this.loadRows();
  }

  playLiked(): void {
    this.player.playAll(this.storage.getFavorites());
  }

  private buildRows(): Row[] {
    const favorites = this.storage.getFavorites();
    const recent = this.storage.getRecentTracks();
    const seeds = [...favorites, ...recent];
    const known = new Set(seeds.map((t) => t.id));
    const onRepeat = this.storage.getMostPlayed(20);
    const hour = new Date().getHours();
    const moodRow: Row = hour >= 22 || hour < 6
      ? this.row('night', 'Late Night Chill', 'bi-moon-stars-fill', () => this.musicApi.getGenreTracks('Downtempo'))
      : hour < 11
        ? this.row('morning', 'Morning Acoustic', 'bi-sunrise-fill', () => this.musicApi.getGenreTracks('Acoustic'))
        : this.row('focus', 'Lo-Fi Focus', 'bi-cup-hot-fill', () => this.musicApi.getGenreTracks('Lo-Fi'));

    const rows: Row[] = [
      this.row('uploads', 'Your Uploads', 'bi-cloud-check-fill', () => this.musicApi.getMyUploads(30)),
      this.row('foryou', 'Made For You', 'bi-stars', () => this.musicApi.getRecommendations(seeds, known, 20),
        seeds.length ? 'Based on what you like and play' : 'Fresh picks to get you started'),
    ];
    if (onRepeat.length >= 3) {
      rows.push(this.row('repeat', 'On Repeat', 'bi-repeat', () => of(onRepeat),
        'Songs you keep coming back to'));
    }
    rows.push(
      this.row('trending', 'Trending This Week', 'bi-fire', () => this.musicApi.getTrendingTracks(20), 'Full-length songs'),
      moodRow,
      this.row('bollywood', 'Bollywood Hits', 'bi-film', () => this.musicApi.getPreviewTracks('bollywood hits'), '30s previews'),
      this.row('punjabi', 'Punjabi Beats', 'bi-music-player-fill', () => this.musicApi.getPreviewTracks('punjabi hits'), '30s previews'),
      this.row('hiphop', 'Hip-Hop', 'bi-mic-fill', () => this.musicApi.getGenreTracks('Hip-Hop/Rap')),
      this.row('electronic', 'Electronic', 'bi-lightning-charge-fill', () => this.musicApi.getGenreTracks('Electronic')),
      this.row('underground', 'Underground Gems', 'bi-gem', () => this.musicApi.getUndergroundTracks(), 'Rising artists'),
      this.row('zen', 'Meditation & Zen', 'bi-flower1', () => this.musicApi.getGenreTracks('Ambient')),
      this.row('world', 'World & Folk', 'bi-globe-asia-australia', () => this.musicApi.getGenreTracks('World')),
      this.row('devotional', 'Devotional', 'bi-brightness-high', () => this.musicApi.getGenreTracks('Devotional')),
      this.row('radio', 'Live Radio', 'bi-broadcast', () => this.musicApi.getRadioStations('india', 12), 'Stations checked for HTTPS streams'),
      this.row('archive', 'From the Archives', 'bi-bank2', () => this.musicApi.getArchiveTracks(10), 'Public-domain recordings'),
    );
    return rows;
  }

  private row(id: string, title: string, icon: string, load: () => Observable<Track[]>, subtitle?: string): Row {
    return { id, title, icon, subtitle, load, tracks: [], loading: true };
  }

  private loadRows(): void {
    this.rows().forEach((row) => {
      row.load()
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.patchRow(row.id, { loading: false }))
        )
        .subscribe({
          next: (tracks) => this.patchRow(row.id, { tracks }),
          error: (err) => console.error(`Failed to load ${row.title}:`, err),
        });
    });
  }

  private patchRow(id: string, patch: Partial<Row>): void {
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  private updateGreeting(): void {
    const hour = new Date().getHours();
    if (hour < 12) this.greeting.set('Good morning');
    else if (hour < 18) this.greeting.set('Good afternoon');
    else this.greeting.set('Good evening');
  }

  private loadPersonal(): void {
    this.recentTracks.set(this.storage.getRecentTracks());
    this.likedCount.set(this.storage.getFavorites().length);
  }

  goToCategory(cat: MusicCategory): void {
    this.router.navigate(['/category', cat.id]);
  }
}
