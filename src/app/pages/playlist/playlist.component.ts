// ============================================
// vibeOnly — Playlist Detail Component
// ============================================

import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { TrackListItemComponent, SkeletonComponent } from '../../shared';
import { LibraryService, PlayerService, MusicApiService } from '../../services';
import { BackService } from '../../services/back.service';
import { Track } from '../../models';

@Component({
  selector: 'app-playlist',
  standalone: true,
  imports: [TrackListItemComponent, SkeletonComponent, RouterLink],
  template: `
    <div class="pl-page vo-fade-in">
      @if (playlist(); as pl) {
        <header class="pl-header">
          <button class="back-btn" (click)="back.goBack()" aria-label="Go back"><i class="bi bi-chevron-left"></i></button>
          <div class="pl-art">
            @if (pl.image) { <img [src]="pl.image" alt="" /> } @else { <i class="bi bi-music-note-list"></i> }
          </div>
          <div class="pl-info">
            <span class="pl-kind">Playlist</span>
            @if (editing()) {
              <form (submit)="saveName($event)" class="pl-rename">
                <input #nameInput type="text" [value]="pl.name" maxlength="60" (input)="draft.set(nameInput.value)" aria-label="Playlist name" />
                <button class="vo-btn vo-btn-primary" type="submit">Save</button>
              </form>
            } @else {
              <h1 class="pl-name" tabindex="0" role="button" (click)="startEdit(pl.name)" (keydown.enter)="startEdit(pl.name)" title="Rename">{{ pl.name }}</h1>
            }
            <p class="pl-meta">{{ pl.tracks.length }} songs · {{ totalMinutes() }} min</p>
          </div>
        </header>

        <div class="pl-actions">
          <button class="vo-btn vo-btn-primary" (click)="player.playAll(pl.tracks)" [disabled]="!pl.tracks.length">
            <i class="bi bi-play-fill"></i> Play
          </button>
          <button class="vo-btn vo-btn-ghost" (click)="player.playAll(pl.tracks, true)" [disabled]="!pl.tracks.length">
            <i class="bi bi-shuffle"></i> Shuffle
          </button>
          <button class="vo-btn vo-btn-ghost vo-btn-icon-only" (click)="player.addToQueue(pl.tracks)" [disabled]="!pl.tracks.length" title="Add all to queue"><i class="bi bi-list-ul"></i></button>
          <button class="vo-btn vo-btn-ghost vo-btn-icon-only" [class.on]="reorder()" (click)="reorder.set(!reorder())" [disabled]="pl.tracks.length < 2" title="Reorder songs"><i class="bi bi-arrow-down-up"></i></button>
          <button class="vo-btn vo-btn-ghost vo-btn-icon-only" (click)="startEdit(pl.name)" title="Rename"><i class="bi bi-pencil"></i></button>
          <button class="vo-btn vo-btn-ghost vo-btn-icon-only danger" (click)="remove()"><i class="bi bi-trash3"></i></button>
        </div>

        <div class="track-list">
          @for (track of pl.tracks; track track.id; let i = $index; let last = $last) {
            <div class="pl-row">
              <app-track-list-item class="pl-row__item" [track]="track" [index]="i + 1" [trackList]="pl.tracks"
                                   [removable]="true" (remove)="library.removeTrack(pl.id, $event.id)"></app-track-list-item>
              @if (reorder()) {
                <button class="move" (click)="library.moveTrack(pl.id, i, i - 1)" [disabled]="i === 0" aria-label="Move up"><i class="bi bi-chevron-up"></i></button>
                <button class="move" (click)="library.moveTrack(pl.id, i, i + 1)" [disabled]="last" aria-label="Move down"><i class="bi bi-chevron-down"></i></button>
              }
            </div>
          } @empty {
            <p class="hint">This playlist is empty. Add songs from the suggestions below, or use the <i class="bi bi-three-dots"></i> menu on any song.</p>
          }
        </div>

        <section class="suggestions">
          <h3 class="vo-section-title">
            Recommended for this playlist
            <button class="vo-btn vo-btn-ghost refresh" (click)="loadSuggestions()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
          </h3>
          @if (loadingSuggestions()) {
            <div class="vo-hscroll">@for (i of [1,2,3,4,5]; track i) { <app-skeleton type="card"></app-skeleton> }</div>
          } @else {
            <div class="suggest-list">
              @for (s of suggestions(); track s.id) {
                <div class="suggest-item">
                  <app-track-list-item class="suggest-track" [track]="s" [index]="$index + 1"></app-track-list-item>
                  <button class="vo-btn vo-btn-ghost add" (click)="addSuggestion(s)">Add</button>
                </div>
              }
            </div>
          }
        </section>
      } @else {
        <div class="hint">
          Playlist not found. <a routerLink="/library" [queryParams]="{ tab: 'playlists' }">Back to your playlists</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .pl-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 120px; }
    .pl-header {
      position: relative; display: flex; align-items: flex-end; gap: 24px;
      padding: 56px 24px 24px; border-radius: var(--vo-radius-lg);
      background: linear-gradient(180deg, rgba(108, 92, 231, 0.45), rgba(108, 92, 231, 0.05));
    }
    .back-btn {
      position: absolute; top: 16px; left: 16px; width: 36px; height: 36px; border-radius: 50%;
      border: none; background: rgba(0,0,0,0.4); color: #fff; cursor: pointer;
    }
    .pl-art {
      width: 160px; height: 160px; flex-shrink: 0; border-radius: var(--vo-radius-md); overflow: hidden;
      display: flex; align-items: center; justify-content: center; background: var(--vo-gradient-accent);
      color: #fff; font-size: 4rem; box-shadow: var(--vo-shadow-lg);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .pl-info { min-width: 0; }
    .pl-kind { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .pl-name { font-size: clamp(1.6rem, 5vw, 3rem); font-weight: 900; margin: 4px 0; cursor: text; word-break: break-word; }
    .pl-meta { margin: 0; color: var(--vo-text-secondary); font-size: 0.9rem; }
    .pl-rename { display: flex; gap: 8px; margin: 8px 0;
      input { flex: 1; min-width: 0; height: 44px; padding: 0 14px; font-size: 1.1rem; font-weight: 700;
        border-radius: var(--vo-radius-md); border: 1px solid var(--vo-accent); background: var(--vo-bg-input); color: var(--vo-text-primary); outline: none; } }
    .pl-actions { display: flex; gap: 8px; flex-wrap: wrap;
      button:disabled { opacity: 0.5; cursor: default; }
      .danger { color: #ff6b6b; } }
    .track-list { display: flex; flex-direction: column; gap: 8px; }
    .pl-row { display: flex; align-items: center; gap: 4px; }
    .pl-row__item { flex: 1; min-width: 0; }
    .move { background: var(--vo-bg-input); border: none; color: var(--vo-text-secondary); width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
      &:disabled { opacity: 0.3; cursor: default; } }
    .on { border-color: var(--vo-accent); color: var(--vo-accent-light); }
    .hint { color: var(--vo-text-muted); font-size: 0.9rem; a { color: var(--vo-accent-light); cursor: pointer; } }
    .refresh { padding: 6px 14px; font-size: 0.8rem; }
    .suggest-list { display: flex; flex-direction: column; gap: 4px; }
    .suggest-item { display: flex; align-items: center; gap: 8px; }
    .suggest-track { flex: 1; min-width: 0; }
    .add { padding: 6px 16px; font-size: 0.8rem; flex-shrink: 0; }
    @media (max-width: 576px) {
      .pl-header { flex-direction: column; align-items: flex-start; padding: 56px 16px 20px; }
      .pl-art { width: 120px; height: 120px; font-size: 3rem; }
    }
  `],
})
export class PlaylistComponent implements OnInit {
  /** Route param */
  readonly id = input.required<string>();

  readonly library = inject(LibraryService);
  readonly player = inject(PlayerService);
  private musicApi = inject(MusicApiService);
  readonly router = inject(Router);
  readonly location = inject(Location);
  readonly back = inject(BackService);

  readonly playlist = computed(() => this.library.getPlaylist(this.id()));
  readonly totalMinutes = computed(() =>
    Math.round((this.playlist()?.tracks.reduce((n, t) => n + (t.duration || 0), 0) || 0) / 60)
  );

  readonly editing = signal(false);
  readonly reorder = signal(false);
  readonly draft = signal('');
  readonly suggestions = signal<Track[]>([]);
  readonly loadingSuggestions = signal(false);

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    const pl = this.playlist();
    if (!pl) return;
    this.loadingSuggestions.set(true);
    const seeds = pl.tracks.length ? pl.tracks : this.player.queue();
    const exclude = new Set(pl.tracks.map((t) => t.id));
    this.musicApi.getRecommendations(seeds, exclude, 10).subscribe({
      next: (tracks) => {
        this.suggestions.set(tracks);
        this.loadingSuggestions.set(false);
      },
      error: () => this.loadingSuggestions.set(false),
    });
  }

  addSuggestion(track: Track): void {
    const pl = this.playlist();
    if (!pl) return;
    this.library.addTrack(pl.id, track);
    this.suggestions.update((s) => s.filter((t) => t.id !== track.id));
  }

  startEdit(name: string): void {
    this.draft.set(name);
    this.editing.set(true);
  }

  saveName(e: Event): void {
    e.preventDefault();
    const pl = this.playlist();
    if (pl) this.library.renamePlaylist(pl.id, this.draft());
    this.editing.set(false);
  }

  remove(): void {
    const pl = this.playlist();
    if (!pl || !confirm(`Delete "${pl.name}"?`)) return;
    this.library.deletePlaylist(pl.id);
    this.router.navigate(['/library'], { queryParams: { tab: 'playlists' } });
  }
}
