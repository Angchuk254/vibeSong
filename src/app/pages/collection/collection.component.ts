// ============================================
// vibeOnly — Public Playlist / Album Page
// ============================================

import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs/operators';
import { TrackListItemComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, PlayerService, LibraryService } from '../../services';
import { BackService } from '../../services/back.service';
import { Collection } from '../../models';

@Component({
  selector: 'app-collection',
  standalone: true,
  imports: [TrackListItemComponent, SkeletonComponent],
  template: `
    <div class="coll-page vo-fade-in">
      <header class="coll-header">
        <button class="back-btn" (click)="back.goBack()" aria-label="Go back"><i class="bi bi-chevron-left"></i></button>
        <div class="coll-art">
          @if (collection()?.image) { <img [src]="collection()!.image" alt="" /> } @else { <i class="bi bi-music-note-list"></i> }
        </div>
        <div class="coll-info">
          <span class="coll-kind">{{ collection()?.isAlbum ? 'Album' : 'Playlist' }}</span>
          <h1>{{ collection()?.name || '' }}</h1>
          @if (collection()?.description) { <p class="coll-desc">{{ collection()!.description }}</p> }
          <p class="coll-meta">
            @if (collection()?.owner) { <strong>{{ collection()!.owner }}</strong> · }
            {{ tracks().length }} songs · {{ minutes() }} min
          </p>
        </div>
      </header>

      <div class="actions">
        <button class="play-btn" (click)="player.playAll(tracks())" [disabled]="!tracks().length" aria-label="Play"><i class="bi bi-play-fill"></i></button>
        <button class="vo-btn vo-btn-ghost" (click)="player.playAll(tracks(), true)" [disabled]="!tracks().length"><i class="bi bi-shuffle"></i> Shuffle</button>
        <button class="vo-btn vo-btn-ghost" (click)="player.addToQueue(tracks())" [disabled]="!tracks().length"><i class="bi bi-list-ul"></i> Queue all</button>
        @if (collection() && tracks().length) {
          <button class="vo-btn" [class.vo-btn-primary]="!saved()" [class.vo-btn-ghost]="saved()" (click)="save()">
            <i class="bi" [class.bi-check-lg]="saved()" [class.bi-plus-lg]="!saved()"></i> {{ saved() ? 'In your library' : 'Save to library' }}
          </button>
        }
      </div>

      <div class="track-list">
        @if (loading()) {
          @for (i of [1,2,3,4,5,6,7,8]; track i) { <app-skeleton type="list"></app-skeleton> }
        } @else {
          @for (t of tracks(); track t.id; let i = $index) {
            <app-track-list-item [track]="t" [index]="i + 1" [trackList]="tracks()"></app-track-list-item>
          } @empty {
            <p class="muted">This playlist has no playable songs right now.</p>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .coll-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 120px; }
    .coll-header { position: relative; display: flex; align-items: flex-end; gap: 24px; padding: 56px 24px 24px; border-radius: var(--vo-radius-lg);
      background: linear-gradient(180deg, rgba(0, 206, 201, 0.35), rgba(108, 92, 231, 0.08)); }
    .back-btn { position: absolute; top: 16px; left: 16px; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(0,0,0,0.4); color: #fff; cursor: pointer; }
    .coll-art { width: 190px; height: 190px; flex-shrink: 0; border-radius: var(--vo-radius-md); overflow: hidden;
      display: flex; align-items: center; justify-content: center; background: var(--vo-gradient-accent); color: #fff; font-size: 4rem; box-shadow: var(--vo-shadow-lg);
      img { width: 100%; height: 100%; object-fit: cover; } }
    .coll-info { min-width: 0;
      h1 { font-size: clamp(1.6rem, 5vw, 3.2rem); font-weight: 900; margin: 4px 0 8px; word-break: break-word; } }
    .coll-kind { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .coll-desc { color: var(--vo-text-secondary); margin: 0 0 6px; font-size: 0.9rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .coll-meta { margin: 0; font-size: 0.88rem; color: var(--vo-text-secondary); strong { color: var(--vo-text-primary); } }
    .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; button:disabled { opacity: 0.5; cursor: default; } }
    .play-btn { width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--vo-accent); color: #fff; font-size: 1.8rem; cursor: pointer; box-shadow: var(--vo-shadow-glow); }
    .track-list { display: flex; flex-direction: column; gap: 6px; }
    .muted { color: var(--vo-text-muted); }
    @media (max-width: 576px) {
      .coll-header { flex-direction: column; align-items: flex-start; padding: 56px 16px 20px; }
      .coll-art { width: 140px; height: 140px; }
    }
  `],
})
export class CollectionComponent implements OnInit, OnDestroy {
  /** Route param, e.g. "audius:xyz" */
  readonly ref = input.required<string>();

  private musicApi = inject(MusicApiService);
  readonly player = inject(PlayerService);
  readonly library = inject(LibraryService);
  readonly location = inject(Location);
  readonly back = inject(BackService);
  private router = inject(Router);

  readonly collection = signal<Collection | null>(null);
  readonly loading = signal(true);
  readonly tracks = computed(() => this.collection()?.tracks || []);
  readonly minutes = computed(() => Math.round(this.tracks().reduce((n, t) => n + (t.duration || 0), 0) / 60));
  readonly saved = computed(() => this.library.isCollectionSaved(this.ref()));

  private ref$ = toObservable(this.ref);
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.ref$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((ref) => this.musicApi.getCollection(ref))
      )
      .subscribe((c) => {
        this.collection.set(c);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  save(): void {
    const c = this.collection();
    if (!c) return;
    // Already saved → open your copy; otherwise save it
    const wasSaved = this.saved();
    const pl = this.library.saveCollection(c, this.tracks());
    if (wasSaved) this.router.navigate(['/playlist', pl.id]);
  }
}
