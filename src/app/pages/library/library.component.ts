// ============================================
// YakBeats — Library Component
// ============================================

import { Component, ElementRef, ViewChild, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TrackListItemComponent, ArtistCardComponent } from '../../shared';
import { StorageService, PlayerService, LibraryService, DeviceMusicService, YouTubeService } from '../../services';
import { MUSIC_CATEGORIES, CATEGORY_GROUPS } from '../../core/categories.data';
import { Track } from '../../models';

type Tab = 'liked' | 'playlists' | 'artists' | 'device' | 'recent' | 'stats';
type Sort = 'recent' | 'title' | 'artist';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, TrackListItemComponent, ArtistCardComponent, RouterLink],
  template: `
    <div class="library-page vo-fade-in">
      <header class="lib-header">
        <div class="lib-top">
          <h1 class="lib-title">Your Library</h1>
          <div class="backup">
            <button class="vo-btn vo-btn-ghost" (click)="exportBackup()" title="Download a backup of your likes, playlists, artists and YouTube songs">
              <i class="bi bi-download"></i> <span class="vo-desktop-only">Export</span>
            </button>
            <label class="vo-btn vo-btn-ghost" title="Restore or merge a backup file">
              <i class="bi bi-upload"></i> <span class="vo-desktop-only">Import</span>
              <input type="file" accept="application/json,.json" hidden (change)="importFile($event)" />
            </label>
          </div>
        </div>
        @if (importMessage()) { <p class="import-msg">{{ importMessage() }}</p> }

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
                <button class="vo-btn vo-btn-primary" (click)="player.playAll(likedView())">
                  <i class="bi bi-play-fill"></i> Play
                </button>
                <button class="vo-btn vo-btn-ghost" (click)="player.playAll(likedView(), true)">
                  <i class="bi bi-shuffle"></i> Shuffle
                </button>
              </div>
              <span class="track-count">{{ favorites().length }} songs</span>
            </div>
            <div class="list-tools">
              <div class="filter-box">
                <i class="bi bi-search"></i>
                <input #likedFilter type="text" placeholder="Find in Liked Songs" [value]="query()" (input)="query.set(likedFilter.value)" aria-label="Filter liked songs" />
              </div>
              <select [value]="sort()" (change)="setSort($event)" aria-label="Sort">
                <option value="recent">Recently added</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
              </select>
            </div>
          }

          <div class="track-list">
            @for (track of likedView(); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="likedView()"></app-track-list-item>
            }
            @if (favorites().length > 0 && likedView().length === 0) {
              <p class="hint">No liked songs match "{{ query() }}".</p>
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

        <!-- Artists -->
        @if (activeTab() === 'artists') {
          <div class="artist-grid">
            @for (a of library.followedArtists(); track a.ref) {
              <app-artist-card [artist]="a"></app-artist-card>
            }
          </div>
          @if (library.followedArtists().length === 0) {
            <div class="empty-state">
              <i class="bi bi-person-plus"></i>
              <p>No artists yet</p>
              <span>Tap an artist's name, then Follow</span>
            </div>
          }
        }

        <!-- Songs on this device -->
        @if (activeTab() === 'device') {
          <div class="device-add">
            <div class="device-add__text">
              <strong><i class="bi bi-music-note-list"></i> Add full songs to My Songs</strong>
              <span>Perfect for Ladakhi, Spiti and other music the free catalogs don't have. Pick a category, then paste a YouTube link or add audio files.</span>
            </div>

            <form class="yt-add" (submit)="addYouTube($event)">
              <i class="bi bi-youtube"></i>
              <input #ytInput type="text" inputmode="url" placeholder="Paste a YouTube song or playlist link"
                     [value]="ytLink()" (input)="ytLink.set(ytInput.value)" [disabled]="ytBusy()" aria-label="YouTube link" />
              <button class="vo-btn vo-btn-primary" type="submit" [disabled]="!ytLink().trim() || ytBusy()">
                @if (ytBusy()) { <i class="bi bi-arrow-repeat spin"></i> } @else { Add }
              </button>
            </form>
            <!-- A playlist is read by briefly cueing it in YouTube's own player, which must be visible -->
            <div class="yt-reader" #ytReader [class.yt-reader--active]="ytReading()"></div>
            @if (ytProgress()) { <span class="hint">{{ ytProgress() }}</span> }

            <div class="device-add__controls">
              <label class="field">
                <span>Category</span>
                <select [value]="importCategory()" (change)="importCategory.set($any($event.target).value)" aria-label="Category for new songs">
                  @for (g of importGroups; track g.id) {
                    <optgroup [label]="g.title">
                      @for (c of categoriesIn(g.id); track c.id) {
                        <option [value]="c.id" [selected]="c.id === importCategory()">{{ c.name }}</option>
                      }
                    </optgroup>
                  }
                </select>
              </label>
              <label class="vo-btn vo-btn-ghost" [class.disabled]="device.importing()">
                <i class="bi bi-folder2-open"></i> Add audio files
                <input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac" multiple hidden
                       [disabled]="!!device.importing()" (change)="addDeviceFiles($event)" />
              </label>
            </div>
            @if (device.importing(); as p) {
              <div class="progress"><div class="progress__bar" [style.width.%]="(p.done / p.total) * 100"></div></div>
              <span class="hint">Adding {{ p.done + 1 > p.total ? p.total : p.done + 1 }} of {{ p.total }}…</span>
            } @else if (deviceMessage()) {
              <span class="import-msg">{{ deviceMessage() }}</span>
            }
          </div>

          @if (device.count() > 0) {
            <div class="action-bar">
              <div class="action-bar__buttons">
                <button class="vo-btn vo-btn-primary" (click)="player.playAll(device.tracks())"><i class="bi bi-play-fill"></i> Play</button>
                <button class="vo-btn vo-btn-ghost" (click)="player.playAll(device.tracks(), true)"><i class="bi bi-shuffle"></i> Shuffle</button>
              </div>
              <span class="track-count">{{ device.count() }} songs</span>
            </div>
          }
          <div class="track-list">
            @for (track of device.tracks(); track track.id; let i = $index) {
              <div class="device-row">
                <app-track-list-item class="device-row__item" [track]="track" [index]="i + 1" [trackList]="device.tracks()"></app-track-list-item>
                <select class="device-row__cat" [value]="track.category" (change)="device.setCategory(deviceId(track), $any($event.target).value)" aria-label="Category">
                  @for (c of allCategories; track c.id) {
                    <option [value]="c.id" [selected]="c.id === track.category">{{ c.name }}</option>
                  }
                </select>
                <button class="device-row__del" (click)="removeDevice(track)" aria-label="Delete from this device"><i class="bi bi-trash3"></i></button>
              </div>
            }
          </div>
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

    .lib-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }

    .lib-title {
      font-size: 2rem;
      font-weight: 800;
      margin: 0;
    }

    .backup {
      display: flex;
      gap: 8px;

      .vo-btn { padding: 8px 14px; }
    }

    .import-msg {
      margin: -8px 0 16px;
      color: var(--vo-secondary);
      font-size: 0.88rem;
    }

    .list-tools {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;

      select {
        height: 38px;
        border-radius: var(--vo-radius-xl);
        border: 1px solid var(--vo-border-light);
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
        padding: 0 12px;
        font-size: 0.85rem;

        option { background: var(--vo-bg-secondary); }
      }
    }

    .filter-box {
      position: relative;
      flex: 1;
      max-width: 320px;

      i {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--vo-text-muted);
        font-size: 0.85rem;
      }

      input {
        width: 100%;
        height: 38px;
        padding: 0 12px 0 34px;
        border-radius: var(--vo-radius-xl);
        border: 1px solid var(--vo-border-light);
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
        outline: none;

        &:focus { border-color: var(--vo-accent); }
      }
    }

    .device-add {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 20px;
      margin-bottom: 20px;
      border-radius: var(--vo-radius-lg);
      background: linear-gradient(135deg, rgba(108, 92, 231, 0.18), var(--vo-bg-card));
      border: 1px solid var(--vo-border-light);
    }

    .device-add__text {
      display: flex;
      flex-direction: column;
      gap: 4px;

      strong { font-size: 1rem; i { color: var(--vo-accent-light); } }
      span { font-size: 0.85rem; color: var(--vo-text-secondary); }
    }

    .yt-add {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 4px 4px 14px;
      border-radius: var(--vo-radius-xl);
      background: var(--vo-bg-input);
      border: 1px solid var(--vo-border-light);

      > i { color: #ff3d3d; font-size: 1.2rem; }

      input {
        flex: 1;
        min-width: 0;
        height: 40px;
        border: none;
        background: none;
        color: var(--vo-text-primary);
        outline: none;
        font-size: 0.9rem;
      }

      button { padding: 8px 18px; }
      button:disabled { opacity: 0.5; }
    }

    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .yt-reader {
      width: 0;
      height: 0;
      overflow: hidden;

      &--active {
        width: 200px;
        height: 200px;
        border-radius: var(--vo-radius-md);
      }
    }

    .device-add__controls {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;

      .disabled { opacity: 0.5; pointer-events: none; }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.75rem;
      color: var(--vo-text-muted);
    }

    .field select,
    .device-row__cat {
      height: 40px;
      border-radius: var(--vo-radius-md);
      border: 1px solid var(--vo-border-light);
      background: var(--vo-bg-input);
      color: var(--vo-text-primary);
      padding: 0 10px;
      font-size: 0.85rem;

      option, optgroup { background: var(--vo-bg-secondary); }
    }

    .progress {
      height: 6px;
      border-radius: 3px;
      background: var(--vo-bg-input);
      overflow: hidden;
    }

    .progress__bar {
      height: 100%;
      background: var(--vo-gradient-accent);
      transition: width 0.2s ease;
    }

    .device-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .device-row__item { flex: 1; min-width: 0; }
    .device-row__cat { height: 34px; max-width: 130px; font-size: 0.78rem; }

    .device-row__del {
      background: none;
      border: none;
      color: var(--vo-text-muted);
      padding: 8px;
      cursor: pointer;

      &:hover { color: #ff6b6b; }
    }

    @media (max-width: 576px) {
      .device-row__cat { max-width: 90px; }
    }

    .artist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
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
    { id: 'artists', label: 'Artists' },
    { id: 'device', label: 'My Songs' },
    { id: 'recent', label: 'Recent' },
    { id: 'stats', label: 'Your Stats' },
  ];

  activeTab = signal<Tab>('liked');
  recent = signal<Track[]>([]);
  mostPlayed = signal<Track[]>([]);
  topArtists = signal<{ name: string; image: string; plays: number }[]>([]);
  totalPlays = signal(0);
  newName = signal('');
  query = signal('');
  sort = signal<Sort>('recent');
  importMessage = signal('');
  readonly device = inject(DeviceMusicService);
  readonly importGroups = CATEGORY_GROUPS.filter((g) => g.id !== 'radio');
  readonly allCategories = MUSIC_CATEGORIES.filter((c) => c.group !== 'radio');
  importCategory = signal('ladakhi');
  deviceMessage = signal('');

  categoriesIn(group: string) {
    return MUSIC_CATEGORIES.filter((c) => c.group === group);
  }

  deviceId(track: Track): string {
    return track.id.replace(/^device-/, '');
  }

  // ── YouTube links ──

  private youtube = inject(YouTubeService);
  @ViewChild('ytReader') ytReader?: ElementRef<HTMLElement>;
  ytLink = signal('');
  ytBusy = signal(false);
  ytReading = signal(false);
  ytProgress = signal('');

  async addYouTube(e: Event): Promise<void> {
    e.preventDefault();
    const { videoId, listId } = this.youtube.parseUrl(this.ytLink());
    if (!videoId && !listId) {
      this.deviceMessage.set("That doesn't look like a YouTube link. Copy it from the Share button on YouTube.");
      return;
    }
    const cat = MUSIC_CATEGORIES.find((c) => c.id === this.importCategory());
    this.ytBusy.set(true);
    this.deviceMessage.set('');
    try {
      let ids: string[] = [];
      if (listId) {
        this.ytReading.set(true);
        this.ytProgress.set('Reading the playlist…');
        try {
          ids = await this.youtube.playlistIds(listId, this.ytReader!.nativeElement);
        } finally {
          this.ytReading.set(false);
        }
      }
      if (!ids.length && videoId) ids = [videoId];
      if (!ids.length) throw new Error('No videos found in that playlist');

      const videos = await this.youtube.videosInfo(ids, (n) => this.ytProgress.set(`Getting song details… ${n} of ${ids.length}`));
      const added = await this.device.addYouTube(videos, this.importCategory());
      this.ytLink.set('');
      this.deviceMessage.set(
        added
          ? `Added ${added} song${added === 1 ? '' : 's'} from YouTube${cat ? ` to ${cat.name}` : ''}. Tap one to play the full song.`
          : 'Those songs are already in My Songs.'
      );
    } catch (err) {
      this.deviceMessage.set(`Couldn't add that link: ${(err as Error)?.message || 'unknown error'}`);
    } finally {
      this.ytBusy.set(false);
      this.ytProgress.set('');
    }
  }

  addDeviceFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const cat = MUSIC_CATEGORIES.find((c) => c.id === this.importCategory());
    this.device.addFiles(files, this.importCategory()).then((n) => {
      this.deviceMessage.set(
        n ? `Added ${n} song${n === 1 ? '' : 's'}${cat ? ` to ${cat.name}` : ''}. They'll show up on the ${cat?.name || ''} page too.` : 'No audio files found in that selection.'
      );
      input.value = '';
      setTimeout(() => this.deviceMessage.set(''), 8000);
    });
  }

  removeDevice(track: Track): void {
    if (confirm(`Delete "${track.name}" from this device?`)) this.device.remove(this.deviceId(track));
  }

  /** Re-reads storage whenever a song is liked/unliked anywhere in the app */
  readonly favorites = computed(() => {
    this.player.favoritesVersion();
    return this.storage.getFavorites();
  });

  /** Liked songs after the filter box and sort menu */
  readonly likedView = computed(() => {
    const q = this.query().trim().toLowerCase();
    let list = this.favorites();
    if (q) list = list.filter((t) => `${t.name} ${t.artist_name} ${t.genre || ''}`.toLowerCase().includes(q));
    if (this.sort() === 'title') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (this.sort() === 'artist') list = [...list].sort((a, b) => a.artist_name.localeCompare(b.artist_name));
    return list;
  });

  setSort(e: Event): void {
    this.sort.set((e.target as HTMLSelectElement).value as Sort);
  }

  async exportBackup(): Promise<void> {
    const filesLeftOut = await this.library.exportLibrary();
    this.importMessage.set(
      'Backup downloaded — keep it somewhere safe (e.g. Google Drive) and use Import on any device to restore.' +
        (filesLeftOut ? ` Note: ${filesLeftOut} audio file${filesLeftOut === 1 ? ' is' : 's are'} not included (too big) — keep your original files.` : '')
    );
    setTimeout(() => this.importMessage.set(''), 10000);
  }

  async importFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const r = await this.library.importLibrary(await file.text());
      this.player.favoritesVersion.update((v) => v + 1);
      this.loadData();
      this.importMessage.set(
        `Imported ${r.songs} liked songs, ${r.playlists} playlists, ${r.artists} artists and ${r.mySongs} YouTube songs.`
      );
    } catch {
      this.importMessage.set("That file isn't a YakBeats backup.");
    }
    input.value = '';
    setTimeout(() => this.importMessage.set(''), 8000);
  }

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    const cat = this.route.snapshot.queryParamMap.get('cat');
    if (cat && MUSIC_CATEGORIES.some((c) => c.id === cat)) this.importCategory.set(cat);
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
