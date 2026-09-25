// ============================================
// vibeOnly — Library Component
// ============================================

import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TrackListItemComponent } from '../../shared';
import { StorageService, PlayerService, LibraryService } from '../../services';
import { Track } from '../../models';

type Tab = 'liked' | 'playlists' | 'recent' | 'stats';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, TrackListItemComponent, RouterLink],
  template: `
    <div class="library-page vo-fade-in">
      <header class="lib-header">
        <h1 class="lib-title">Your Library</h1>

        <div class="lib-tabs" role="tablist">
          @for (t of tabs; track t.id) {
            <button class="lib-tab" role="tab" [attr.aria-selected]="activeTab() === t.id"
                    [class.active]="activeTab() === t.id" (click)="setTab(t.id)">
              {{ t.label }}
            </button>
          }
        </div>
      </header>

      <section class="lib-content">
        <!-- Liked Songs -->
        @if (activeTab() === 'liked') {
          @if (favorites().length > 0) {
            <div class="action-bar">
              <div class="action-bar__buttons">
                <button class="vo-btn vo-btn-primary" (click)="player.playAll(favorites())">
                  <i class="bi bi-play-fill"></i> Play
                </button>
                <button class="vo-btn vo-btn-ghost" (click)="player.playAll(favorites(), true)">
                  <i class="bi bi-shuffle"></i> Shuffle
                </button>
              </div>
              <span class="track-count">{{ favorites().length }} songs</span>
            </div>
          }

          <div class="track-list">
            @for (track of favorites(); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="favorites()"></app-track-list-item>
            }
            @if (favorites().length === 0) {
              <div class="empty-state">
                <i class="bi bi-heart"></i>
                <p>No liked songs yet</p>
                <span>Tap the heart on any song to save it here</span>
              </div>
            }
          </div>
        }

        <!-- Playlists -->
        @if (activeTab() === 'playlists') {
          <form class="new-playlist" (submit)="createPlaylist($event)">
            <input #plName type="text" placeholder="New playlist name" maxlength="60"
                   [value]="newName()" (input)="newName.set(plName.value)" />
            <button class="vo-btn vo-btn-primary" type="submit" [disabled]="!newName().trim()">
              <i class="bi bi-plus-lg"></i> Create
            </button>
          </form>

          <div class="playlist-grid">
            <button type="button" class="playlist-card" (click)="setTab('liked')">
              <span class="playlist-card__art playlist-card__art--liked"><i class="bi bi-heart-fill"></i></span>
              <span class="playlist-card__name">Liked Songs</span>
              <span class="playlist-card__meta">{{ favorites().length }} songs</span>
            </button>
            @for (pl of library.playlists(); track pl.id) {
              <a class="playlist-card" [routerLink]="['/playlist', pl.id]">
                <span class="playlist-card__art">
                  @if (pl.image) { <img [src]="pl.image" alt="" loading="lazy" /> } @else { <i class="bi bi-music-note-list"></i> }
                </span>
                <span class="playlist-card__name">{{ pl.name }}</span>
                <span class="playlist-card__meta">{{ pl.tracks.length }} songs</span>
              </a>
            }
          </div>
          @if (library.playlists().length === 0) {
            <p class="hint">Create a playlist above, or use the <i class="bi bi-three-dots"></i> menu on any song → "Add to playlist".</p>
          }
        }

        <!-- Recent -->
        @if (activeTab() === 'recent') {
          @if (recent().length > 0) {
            <div class="action-bar">
              <div class="action-bar__buttons">
                <button class="vo-btn vo-btn-primary" (click)="player.playAll(recent())">
                  <i class="bi bi-play-fill"></i> Play
                </button>
                <button class="vo-btn vo-btn-ghost" (click)="clearRecent()">
                  <i class="bi bi-trash3"></i> Clear
                </button>
              </div>
              <span class="track-count">{{ recent().length }} songs</span>
            </div>
          }

          <div class="track-list">
            @for (track of recent(); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="recent()"></app-track-list-item>
            }
            @if (recent().length === 0) {
              <div class="empty-state">
                <i class="bi bi-clock-history"></i>
                <p>No recent plays</p>
                <span>Start listening to see your history</span>
              </div>
            }
          </div>
        }

        <!-- Stats -->
        @if (activeTab() === 'stats') {
          <div class="stats">
            <div class="stat-tiles">
              <div class="stat-tile"><strong>{{ totalPlays() }}</strong><span>plays</span></div>
              <div class="stat-tile"><strong>{{ favorites().length }}</strong><span>liked</span></div>
              <div class="stat-tile"><strong>{{ library.playlists().length }}</strong><span>playlists</span></div>
            </div>

            @if (topArtists().length > 0) {
              <h3 class="vo-section-title">Your Top Artists</h3>
              <div class="artist-row">
                @for (a of topArtists(); track a.name) {
                  <button class="artist" (click)="searchArtist(a.name)">
                    <img [src]="a.image || 'icons/icon-192x192.png'" alt="" loading="lazy" />
                    <span class="artist__name">{{ a.name }}</span>
                    <span class="artist__plays">{{ a.plays }} plays</span>
                  </button>
                }
              </div>
            }

            <h3 class="vo-section-title">
              On Repeat
              @if (mostPlayed().length > 0) {
                <button class="vo-btn vo-btn-primary play-small" (click)="player.playAll(mostPlayed())"><i class="bi bi-play-fill"></i> Play</button>
              }
            </h3>
            <div class="track-list">
              @for (track of mostPlayed(); track track.id; let i = $index) {
                <app-track-list-item [track]="track" [index]="i + 1" [trackList]="mostPlayed()"></app-track-list-item>
              } @empty {
                <p class="hint">Play a few songs more than once and they'll show up here.</p>
              }
            </div>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    .library-page {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 120px;
    }

    .lib-title {
      font-size: 2rem;
      font-weight: 800;
      margin: 0 0 20px;
    }

    .lib-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--vo-border);
      padding-bottom: 2px;
      overflow-x: auto;
      scrollbar-width: none;
    }

    .lib-tab {
      background: none;
      border: none;
      color: var(--vo-text-secondary);
      font-size: 1rem;
      font-weight: 600;
      padding: 8px 14px;
      cursor: pointer;
      position: relative;
      white-space: nowrap;
      transition: color var(--vo-transition);

      &:hover {
        color: var(--vo-text-primary);
      }

      &.active {
        color: var(--vo-accent-light);

        &::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--vo-accent);
          border-radius: 3px 3px 0 0;
        }
      }
    }

    .action-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      padding: 8px 0;
    }

    .action-bar__buttons {
      display: flex;
      gap: 8px;
    }

    .track-count {
      color: var(--vo-text-muted);
      font-size: 0.9rem;
    }

    .track-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .new-playlist {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      max-width: 480px;

      input {
        flex: 1;
        min-width: 0;
        height: 44px;
        padding: 0 16px;
        border-radius: var(--vo-radius-xl);
        border: 1px solid var(--vo-border-light);
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
        outline: none;

        &:focus { border-color: var(--vo-accent); }
      }

      button:disabled { opacity: 0.5; cursor: default; }
    }

    .playlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 18px;
    }

    .playlist-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-decoration: none;
      color: var(--vo-text-primary);
      cursor: pointer;
      padding: 10px;
      background: none;
      border: none;
      text-align: left;
      font: inherit;
      border-radius: var(--vo-radius-md);
      transition: background var(--vo-transition-fast);

      &:hover { background: var(--vo-bg-input); }
    }

    .playlist-card__art {
      aspect-ratio: 1;
      border-radius: var(--vo-radius-md);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vo-gradient-accent);
      color: #fff;
      font-size: 2.4rem;
      margin-bottom: 6px;
      box-shadow: var(--vo-shadow-sm);

      img { width: 100%; height: 100%; object-fit: cover; }

      &--liked { background: linear-gradient(135deg, #4a00e0, #8e2de2); }
    }

    .playlist-card__name {
      font-weight: 700;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .playlist-card__meta {
      font-size: 0.78rem;
      color: var(--vo-text-muted);
    }

    .hint {
      color: var(--vo-text-muted);
      font-size: 0.9rem;
      margin: 16px 0;
    }

    .stats {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .stat-tiles {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      max-width: 520px;
    }

    .stat-tile {
      background: var(--vo-bg-card);
      border: 1px solid var(--vo-border);
      border-radius: var(--vo-radius-md);
      padding: 16px;
      display: flex;
      flex-direction: column;

      strong { font-size: 1.6rem; font-weight: 800; }
      span { color: var(--vo-text-muted); font-size: 0.8rem; }
    }

    .artist-row {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 4px;
    }

    .artist {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 120px;
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--vo-text-primary);
      cursor: pointer;

      img {
        width: 104px;
        height: 104px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 6px;
        box-shadow: var(--vo-shadow-sm);
      }
    }

    .artist__name {
      font-weight: 700;
      font-size: 0.85rem;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .artist__plays {
      font-size: 0.72rem;
      color: var(--vo-text-muted);
    }

    .play-small {
      padding: 6px 16px;
      font-size: 0.8rem;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      text-align: center;
      color: var(--vo-text-muted);

      i {
        font-size: 3.5rem;
        margin-bottom: 16px;
        color: var(--vo-border);
      }

      p {
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--vo-text-primary);
        margin: 0 0 8px;
      }

      span {
        font-size: 0.95rem;
      }
    }
  `]
})
export class LibraryComponent implements OnInit {
  private storage = inject(StorageService);
  readonly player = inject(PlayerService);
  readonly library = inject(LibraryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'liked', label: 'Liked Songs' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'recent', label: 'Recent' },
    { id: 'stats', label: 'Your Stats' },
  ];

  activeTab = signal<Tab>('liked');
  recent = signal<Track[]>([]);
  mostPlayed = signal<Track[]>([]);
  topArtists = signal<{ name: string; image: string; plays: number }[]>([]);
  totalPlays = signal(0);
  newName = signal('');

  /** Re-reads storage whenever a song is liked/unliked anywhere in the app */
  readonly favorites = computed(() => {
    this.player.favoritesVersion();
    return this.storage.getFavorites();
  });

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && this.tabs.some((t) => t.id === tab)) this.activeTab.set(tab);
    this.loadData();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.loadData();
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  loadData(): void {
    this.recent.set(this.storage.getRecentTracks());
    this.mostPlayed.set(this.storage.getMostPlayed(25));
    this.topArtists.set(this.storage.getTopArtists(8));
    this.totalPlays.set(this.storage.getTotalPlays());
  }

  createPlaylist(e: Event): void {
    e.preventDefault();
    if (!this.newName().trim()) return;
    const pl = this.library.createPlaylist(this.newName());
    this.newName.set('');
    this.router.navigate(['/playlist', pl.id]);
  }

  clearRecent(): void {
    this.storage.clearRecent();
    this.recent.set([]);
  }

  searchArtist(name: string): void {
    this.router.navigate(['/search'], { queryParams: { q: name } });
  }
}
