// ============================================
// vibeOnly — Home Page Component
// ============================================

import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TrackCardComponent, SkeletonComponent, ArtistCardComponent, CollectionCardComponent } from '../../shared';
import { MusicApiService, StorageService, PlayerService, LibraryService, DeviceMusicService, LocationService } from '../../services';
import { DAILY_VIBES, LOCAL_FLAVOURS, pickForDay } from '../../core/vibes.data';
import { Track, MusicCategory, ArtistSummary, Collection } from '../../models';
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
  imports: [CommonModule, RouterLink, TrackCardComponent, SkeletonComponent, ArtistCardComponent, CollectionCardComponent],
  template: `
    <div class="home vo-fade-in">
      <!-- Header -->
      <header class="home__header">
        <div class="home__intro">
          <h2 class="home__greeting">{{ greeting() }}</h2>
          @if (placeLabel()) {
            <div class="home__place-row">
              <p class="home__place">
                <i class="bi" [class.bi-geo-alt-fill]="!location.locating()" [class.bi-arrow-repeat]="location.locating()" [class.spin]="location.locating()"></i>
                Vibing from <strong>{{ placeLabel() }}</strong>
              </p>
              @if (location.place()?.source === 'ip' && location.canUseDevice && !location.locating()) {
                <button class="home__precise" (click)="location.usePreciseLocation()" aria-label="Use my precise location" title="Use my precise location">
                  <i class="bi bi-crosshair"></i>
                </button>
              }
            </div>
          } @else if (location.enabled() && location.locating()) {
            <p class="home__place"><i class="bi bi-arrow-repeat spin"></i> Finding your vibe spot…</p>
          }
          <div class="home__vibe">
            <p class="home__vibe-text">{{ vibe() }}</p>
            <button class="home__vibe-shuffle" (click)="vibeSalt.set(vibeSalt() + 1)" aria-label="Another message" title="Another message">
              <i class="bi bi-shuffle"></i>
            </button>
          </div>
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
          <button class="category-pill category-pill--more" (click)="router.navigate(['/search'])">
            <i class="bi bi-grid-3x3-gap-fill"></i>
            <span>All {{ totalCategories }}</span>
          </button>
        </div>
      </section>

      <!-- Quick picks: liked + recent -->
      @if (recentTracks().length > 0 || likedCount() > 0 || library.playlists().length > 0) {
        <section class="home__section">
          <div class="quick-grid">
            @if (likedCount() > 0) {
              <button class="quick-tile" (click)="playLiked()">
                <span class="quick-tile__art quick-tile__art--liked"><i class="bi bi-heart-fill"></i></span>
                <span class="quick-tile__name">Liked Songs<small>{{ likedCount() }} songs</small></span>
                <i class="bi bi-play-circle-fill quick-tile__play"></i>
              </button>
            }
            @for (pl of library.playlists().slice(0, 3); track pl.id) {
              <a class="quick-tile" [routerLink]="['/playlist', pl.id]">
                @if (pl.image) { <img class="quick-tile__art" [src]="pl.image" alt="" loading="lazy" /> }
                @else { <span class="quick-tile__art quick-tile__art--liked"><i class="bi bi-music-note-list"></i></span> }
                <span class="quick-tile__name">{{ pl.name }}<small>{{ pl.tracks.length }} songs</small></span>
                <i class="bi bi-play-circle-fill quick-tile__play"></i>
              </a>
            }
            @for (track of recentTracks().slice(0, quickSlots()); track track.id) {
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
        @if (row.id === 'bollywood') {
          @if (playlists().length > 0) {
            <section class="home__section">
              <h3 class="vo-section-title"><span class="row-title"><i class="bi bi-collection-play-fill"></i><span>Popular Playlists<small>Curated by the community</small></span></span></h3>
              <div class="vo-hscroll">
                @for (c of playlists(); track c.ref) { <app-collection-card [collection]="c"></app-collection-card> }
              </div>
            </section>
          }
          @if (artists().length > 0) {
            <section class="home__section">
              <h3 class="vo-section-title"><span class="row-title"><i class="bi bi-person-hearts"></i><span>Popular Artists</span></span></h3>
              <div class="vo-hscroll">
                @for (a of artists(); track a.ref) { <app-artist-card [artist]="a"></app-artist-card> }
              </div>
            </section>
          }
        }
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

      @if (device.count() > 0) {
        <section class="home__section home__section--device">
          <h3 class="vo-section-title">
            <span class="row-title"><i class="bi bi-phone"></i><span>On This Device<small>Your own songs, full length</small></span></span>
            <span class="row-actions">
              <button class="row-btn" (click)="player.playAll(device.tracks(), true)" aria-label="Shuffle play"><i class="bi bi-shuffle"></i></button>
              <button class="row-btn row-btn--play" (click)="player.playAll(device.tracks())" aria-label="Play all"><i class="bi bi-play-fill"></i></button>
            </span>
          </h3>
          <div class="vo-hscroll">
            @for (t of device.tracks(); track t.id) { <app-track-card [track]="t" [trackList]="device.tracks()"></app-track-card> }
          </div>
        </section>
      }

      @if (library.followedArtists().length > 0) {
        <section class="home__section">
          <h3 class="vo-section-title"><span class="row-title"><i class="bi bi-person-check-fill"></i><span>Artists You Follow</span></span></h3>
          <div class="vo-hscroll">
            @for (a of library.followedArtists(); track a.ref) { <app-artist-card [artist]="a"></app-artist-card> }
          </div>
        </section>
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

    .home__intro {
      min-width: 0;
      flex: 1;
    }

    /* Refresh sits in the corner so the message can use the full width */
    .home__header { position: relative; }
    .home__refresh { position: absolute; top: 0; right: 0; }
    .home__greeting { padding-right: 52px; }

    .home__place {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0 0;
      padding: 4px 12px 4px 10px;
      border-radius: var(--vo-radius-xl);
      background: var(--vo-bg-input);
      border: 1px solid var(--vo-border-light);
      font-size: 0.82rem;
      color: var(--vo-text-secondary);
      max-width: 100%;

      i { color: #ff6b6b; }
      strong {
        color: var(--vo-text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .home__place-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      max-width: 100%;

      .home__place { margin: 0; min-width: 0; }
    }

    .home__precise {
      flex-shrink: 0;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid var(--vo-border-light);
      background: var(--vo-bg-input);
      color: var(--vo-accent-light);
      cursor: pointer;
    }

    .spin { display: inline-block; animation: homeSpin 1s linear infinite; }
    @keyframes homeSpin { to { transform: rotate(360deg); } }

    .home__vibe {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 12px;
      max-width: 620px;
      padding: 12px 14px;
      border-radius: var(--vo-radius-md);
      background: linear-gradient(135deg, rgba(108, 92, 231, 0.16), rgba(0, 206, 201, 0.08));
      border: 1px solid var(--vo-border);
    }

    .home__vibe-text {
      flex: 1;
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
      color: var(--vo-text-primary);
    }

    .home__vibe-shuffle {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: none;
      background: var(--vo-bg-input);
      color: var(--vo-text-secondary);
      cursor: pointer;

      &:hover { color: var(--vo-text-primary); }
      &:active i { display: inline-block; transform: rotate(180deg); transition: transform 0.2s; }
    }

    @media (max-width: 576px) {
      .home__greeting { font-size: 1.5rem; }
      .home__vibe-text { font-size: 0.86rem; }
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

      &--more {
        background: var(--vo-bg-card);
        color: var(--vo-text-primary);
        text-shadow: none;
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
      text-decoration: none;
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

    @media (hover: none), (max-width: 576px) {
      .quick-tile__play { display: none; }
      .quick-tile { padding-right: 8px; gap: 8px; }
      .quick-tile__art { width: 52px; height: 52px; }
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
  readonly library = inject(LibraryService);
  readonly device = inject(DeviceMusicService);
  readonly router = inject(Router);
  readonly totalCategories = MUSIC_CATEGORIES.length;
  private destroy$ = new Subject<void>();

  private readonly featured = ['bollywood', 'punjabi', 'hindi', 'pop', 'hiphop', 'lofi', 'chill', 'workout', 'romance',
    'ladakhi', 'spiti', 'tibet', 'nepal', 'bhutan', 'radio-himalayan', 'kpop', 'electronic', 'rock', 'devotional', 'radio'];
  categories = this.featured.map((id) => MUSIC_CATEGORIES.find((c) => c.id === id)!).filter(Boolean);
  recentTracks = signal<Track[]>([]);
  likedCount = signal(0);
  readonly location = inject(LocationService);
  private readonly now = signal(new Date());
  readonly vibeSalt = signal(0);

  /** Local hello for Himalayan places (Julley, Namaste, Kuzuzangpo la…) */
  private readonly flavour = computed(() => {
    const p = this.location.place();
    if (!p) return null;
    const text = `${p.city} ${p.region} ${p.country}`;
    return LOCAL_FLAVOURS.find((f) => f.match.test(text)) || null;
  });

  readonly placeLabel = computed(() => (this.location.enabled() ? this.location.label() : ''));

  readonly greeting = computed(() => {
    const h = this.now().getHours();
    const base = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Late-night vibes';
    const hello = this.flavour()?.hello;
    return hello ? `${hello}! ${base}` : base;
  });

  /** Today's message: same all day, new tomorrow, 🔀 for another */
  readonly vibe = computed(() => {
    const today = this.now();
    const local = this.flavour()?.vibes || [];
    const pool = [...local, ...DAILY_VIBES[today.getDay()]];
    const place = this.location.enabled() && this.location.place()?.city ? this.location.place()!.city : 'your corner of the world';
    return pickForDay(pool, today, this.vibeSalt()).replaceAll('{place}', place);
  });
  rows = signal<Row[]>([]);
  playlists = signal<Collection[]>([]);
  artists = signal<ArtistSummary[]>([]);

  /** Recent songs fill whatever is left of the 6 quick tiles */
  quickSlots(): number {
    const used = (this.likedCount() > 0 ? 1 : 0) + Math.min(3, this.library.playlists().length);
    return Math.max(0, 6 - used);
  }

  ngOnInit(): void {
    this.location.refresh();
    // Keep the greeting right if the app stays open past a time boundary
    const tick = setInterval(() => this.now.set(new Date()), 60000);
    this.destroy$.subscribe(() => clearInterval(tick));
    this.loadPersonal();
    this.rows.set(this.buildRows());
    this.loadRows();
    this.loadDiscovery();
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
    this.loadDiscovery();
  }

  private loadDiscovery(): void {
    this.musicApi.getTrendingPlaylists(16).pipe(takeUntil(this.destroy$)).subscribe((p) => this.playlists.set(p));
    this.musicApi.getTrendingArtists(14).pipe(takeUntil(this.destroy$)).subscribe((a) => this.artists.set(a));
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
      this.row('himalayan', 'Himalayan Corner', 'bi-snow2', () => this.musicApi.getHimalayanMix(24), 'Ladakhi, Spiti & Kinnaur, Tibetan'),
      this.row('trending', 'Trending This Week', 'bi-fire', () => this.musicApi.getTrendingTracks(20), 'Full-length songs'),
      moodRow,
      this.row('bollywood', 'Bollywood Hits', 'bi-film', () => this.musicApi.getPreviewTracks('bollywood hits'), '30s previews'),
      this.row('punjabi', 'Punjabi Beats', 'bi-music-player-fill', () => this.musicApi.getPreviewTracks('punjabi hits'), '30s previews'),
      this.row('global', 'Global Top Hits', 'bi-globe2', () => this.musicApi.getPreviewTracks('top hits 2025', 15, 'US'), '30s previews'),
      this.row('hiphop', 'Hip-Hop', 'bi-mic-fill', () => this.musicApi.getGenreTracks('Hip-Hop/Rap')),
      this.row('rnb', 'R&B & Soul', 'bi-heart-pulse-fill', () => this.musicApi.getGenreTracks('R&B/Soul')),
      this.row('electronic', 'Electronic', 'bi-lightning-charge-fill', () => this.musicApi.getGenreTracks('Electronic')),
      this.row('underground', 'Underground Gems', 'bi-gem', () => this.musicApi.getUndergroundTracks(), 'Rising artists'),
      this.row('zen', 'Meditation & Zen', 'bi-flower1', () => this.musicApi.getGenreTracks('Ambient')),
      this.row('rock', 'Rock', 'bi-lightning-fill', () => this.musicApi.getGenreTracks('Rock')),
      this.row('jazz', 'Jazz Lounge', 'bi-music-note-list', () => this.musicApi.getGenreTracks('Jazz')),
      this.row('world', 'World & Folk', 'bi-globe-asia-australia', () => this.musicApi.getGenreTracks('World')),
      this.row('kpop', 'K-Pop', 'bi-stars', () => this.musicApi.getPreviewTracks('k-pop', 15, 'KR'), '30s previews'),
      this.row('devotional', 'Devotional', 'bi-brightness-high', () => this.musicApi.getGenreTracks('Devotional')),
      this.row('himradio', 'Himalayan Radio', 'bi-broadcast-pin', () => this.musicApi.getRadioStations('himalayan', 14), 'Live from Nepal, Bhutan, Ladakh & Tibet'),
      this.row('radio', 'Live Radio India', 'bi-broadcast', () => this.musicApi.getRadioStations('india', 12), 'Stations checked for HTTPS streams'),
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


  private loadPersonal(): void {
    this.recentTracks.set(this.storage.getRecentTracks());
    this.likedCount.set(this.storage.getFavorites().length);
  }

  goToCategory(cat: MusicCategory): void {
    this.router.navigate(['/category', cat.id]);
  }
}
