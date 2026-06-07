// ============================================
// vibeOnly — Library Component
// ============================================

import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrackListItemComponent } from '../../shared';
import { StorageService, PlayerService } from '../../services';
import { RadioProvider } from '../../core/providers/radio.provider';
import { Track } from '../../models';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, TrackListItemComponent],
  template: `
    <div class="library-page vo-fade-in">
      <header class="lib-header">
        <h1 class="lib-title">Your Library</h1>
        
        <div class="lib-tabs">
          <button class="lib-tab" [class.active]="activeTab() === 'favorites'" (click)="activeTab.set('favorites')">
            Favorites
          </button>
          <button class="lib-tab" [class.active]="activeTab() === 'recent'" (click)="activeTab.set('recent')">
            Recent
          </button>
          <button class="lib-tab" [class.active]="activeTab() === 'radio'" (click)="activeTab.set('radio')">
            Live Radio
          </button>
        </div>
      </header>

      <section class="lib-content">
        <!-- Favorites Tab -->
        @if (activeTab() === 'favorites') {
          @if (favorites().length > 0) {
            <div class="action-bar">
              <button class="vo-btn vo-btn-primary" (click)="playAll(favorites())">
                <i class="bi bi-play-fill"></i> Play All
              </button>
              <span class="track-count">{{ favorites().length }} tracks</span>
            </div>
          }

          <div class="track-list">
            @for (track of favorites(); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="favorites()"></app-track-list-item>
            }
            @if (favorites().length === 0) {
              <div class="empty-state">
                <i class="bi bi-heart"></i>
                <p>No favorites yet</p>
                <span>Like a track to see it here</span>
              </div>
            }
          </div>
        }

        <!-- Recent Tab -->
        @if (activeTab() === 'recent') {
          @if (recent().length > 0) {
            <div class="action-bar">
              <button class="vo-btn vo-btn-primary" (click)="playAll(recent())">
                <i class="bi bi-play-fill"></i> Play All
              </button>
              <span class="track-count">{{ recent().length }} tracks</span>
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
                <span>Start listening to see history</span>
              </div>
            }
          </div>
        }

        <!-- Radio Tab -->
        @if (activeTab() === 'radio') {
          @if (radioTracks().length > 0) {
            <div class="action-bar">
              <button class="vo-btn vo-btn-primary" (click)="playAll(radioTracks())">
                <i class="bi bi-play-fill"></i> Play All
              </button>
              <span class="track-count">{{ radioTracks().length }} stations</span>
            </div>
          }

          <div class="track-list">
            @for (track of radioTracks(); track track.id; let i = $index) {
              <app-track-list-item [track]="track" [index]="i + 1" [trackList]="radioTracks()"></app-track-list-item>
            }
            @if (isLoadingRadio()) {
              <div class="empty-state">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
            } @else if (radioTracks().length === 0) {
              <div class="empty-state">
                <i class="bi bi-boombox"></i>
                <p>No stations found</p>
              </div>
            }
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
    }

    .lib-title {
      font-size: 2rem;
      font-weight: 800;
      margin: 0 0 20px;
    }

    .lib-tabs {
      display: flex;
      gap: 12px;
      border-bottom: 1px solid var(--vo-border);
      padding-bottom: 2px;
    }

    .lib-tab {
      background: none;
      border: none;
      color: var(--vo-text-secondary);
      font-size: 1.05rem;
      font-weight: 600;
      padding: 8px 16px;
      cursor: pointer;
      position: relative;
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
      margin-bottom: 16px;
      padding: 8px 0;
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
  private player = inject(PlayerService);
  private radioApi = inject(RadioProvider);

  activeTab = signal<'favorites' | 'recent' | 'radio'>('favorites');
  favorites = signal<Track[]>([]);
  recent = signal<Track[]>([]);
  radioTracks = signal<Track[]>([]);
  isLoadingRadio = signal(true);

  ngOnInit(): void {
    this.loadData();
    // Since storage is synchronous and doesn't emit events on changes without a service bus,
    // we just load on init. For a real app, an RxJS Subject in StorageService would be better.
  }

  loadData(): void {
    this.favorites.set(this.storage.getFavorites());
    this.recent.set(this.storage.getRecentTracks());
    
    this.radioApi.getFeaturedTracks(15).subscribe({
      next: (tracks) => {
        this.radioTracks.set(tracks);
        this.isLoadingRadio.set(false);
      },
      error: () => this.isLoadingRadio.set(false)
    });
  }

  playAll(tracks: Track[]): void {
    if (tracks.length > 0) {
      this.player.playTrack(tracks[0], tracks);
    }
  }
}
