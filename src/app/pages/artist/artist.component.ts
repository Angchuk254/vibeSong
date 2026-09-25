// ============================================
// vibeOnly — Artist Page
// ============================================

import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs/operators';
import { TrackListItemComponent, SkeletonComponent } from '../../shared';
import { MusicApiService, PlayerService, LibraryService } from '../../services';
import { BackService } from '../../services/back.service';
import { ArtistSummary, Track } from '../../models';

@Component({
  selector: 'app-artist',
  standalone: true,
  imports: [TrackListItemComponent, SkeletonComponent],
  template: `
    <div class="artist-page vo-fade-in">
      <header class="hero" [style.background-image]="artist()?.cover ? 'url(' + artist()!.cover + ')' : null">
        <div class="hero__shade"></div>
        <button class="back-btn" (click)="back.goBack()" aria-label="Go back"><i class="bi bi-chevron-left"></i></button>
        <div class="hero__content">
          <div class="hero__avatar">
            @if (artist()?.image) { <img [src]="artist()!.image" alt="" /> } @else { <i class="bi bi-person-fill"></i> }
          </div>
          <div class="hero__text">
            @if (artist()?.verified) { <span class="hero__verified"><i class="bi bi-patch-check-fill"></i> Verified artist</span> }
            <h1>{{ artist()?.name || (loading() ? '' : 'Artist') }}</h1>
            <p>
              @if (artist()?.followers) { {{ formatCount(artist()!.followers!) }} followers · }
              {{ tracks().length }} songs
              @if (isPreviewArtist()) { · 30s previews }
            </p>
          </div>
        </div>
      </header>

      <div class="actions">
        <button class="play-btn" (click)="player.playAll(tracks())" [disabled]="!tracks().length" aria-label="Play">
          <i class="bi bi-play-fill"></i>
        </button>
        <button class="vo-btn vo-btn-ghost" (click)="player.playAll(tracks(), true)" [disabled]="!tracks().length">
          <i class="bi bi-shuffle"></i> Shuffle
        </button>
        @if (artist()) {
          <button class="vo-btn vo-btn-ghost" [class.following]="library.isFollowing(artist()!.ref)" (click)="library.toggleFollow(artist()!)">
            {{ library.isFollowing(artist()!.ref) ? 'Following' : 'Follow' }}
          </button>
        }
      </div>

      <section>
        <h3 class="vo-section-title">Popular</h3>
        <div class="track-list">
          @if (loading()) {
            @for (i of [1,2,3,4,5,6]; track i) { <app-skeleton type="list"></app-skeleton> }
          } @else {
            @for (t of visibleTracks(); track t.id; let i = $index) {
              <app-track-list-item [track]="t" [index]="i + 1" [trackList]="tracks()"></app-track-list-item>
            } @empty {
              <p class="muted">No playable songs found for this artist.</p>
            }
            @if (tracks().length > 10) {
              <button class="vo-btn vo-btn-ghost more" (click)="showAll.set(!showAll())">{{ showAll() ? 'Show less' : 'See all ' + tracks().length }}</button>
            }
          }
        </div>
      </section>

      @if (artist()?.bio) {
        <section class="about">
          <h3 class="vo-section-title">About</h3>
          <p>{{ artist()!.bio }}</p>
        </section>
      }
    </div>
  `,
  styles: [`
    .artist-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 120px; }
    .hero {
      position: relative; min-height: 280px; border-radius: var(--vo-radius-lg); overflow: hidden;
      background: var(--vo-gradient-accent) center / cover no-repeat; display: flex; align-items: flex-end;
    }
    .hero__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.75)); }
    .back-btn { position: absolute; top: 16px; left: 16px; z-index: 2; width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(0,0,0,0.45); color: #fff; cursor: pointer; }
    .hero__content { position: relative; z-index: 1; display: flex; align-items: flex-end; gap: 24px; padding: 24px; color: #fff; min-width: 0; }
    .hero__avatar {
      width: 170px; height: 170px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.15); font-size: 4rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .hero__text { min-width: 0;
      h1 { font-size: clamp(2rem, 6vw, 4.2rem); font-weight: 900; margin: 4px 0; line-height: 1.05; word-break: break-word; }
      p { margin: 0; opacity: 0.85; } }
    .hero__verified { font-size: 0.8rem; font-weight: 600; i { color: #3d91ff; } }
    .actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      button:disabled { opacity: 0.5; cursor: default; }
      .following { border-color: var(--vo-accent); color: var(--vo-accent-light); } }
    .play-btn { width: 56px; height: 56px; border-radius: 50%; border: none; background: var(--vo-accent); color: #fff; font-size: 1.8rem; cursor: pointer; box-shadow: var(--vo-shadow-glow);
      &:hover:not(:disabled) { transform: scale(1.05); } }
    .track-list { display: flex; flex-direction: column; gap: 6px; }
    .more { align-self: flex-start; margin-top: 8px; }
    .muted { color: var(--vo-text-muted); }
    .about p { color: var(--vo-text-secondary); white-space: pre-line; max-width: 720px; line-height: 1.6; }
    @media (max-width: 576px) {
      .hero__content { flex-direction: column; align-items: flex-start; gap: 12px; padding: 56px 16px 20px; }
      .hero__avatar { width: 120px; height: 120px; }
    }
  `],
})
export class ArtistComponent implements OnInit, OnDestroy {
  /** Route param, e.g. "audius:abc" */
  readonly ref = input.required<string>();

  private musicApi = inject(MusicApiService);
  readonly player = inject(PlayerService);
  readonly library = inject(LibraryService);
  readonly location = inject(Location);
  readonly back = inject(BackService);

  readonly artist = signal<ArtistSummary | null>(null);
  readonly tracks = signal<Track[]>([]);
  readonly loading = signal(true);
  readonly showAll = signal(false);
  readonly visibleTracks = computed(() => (this.showAll() ? this.tracks() : this.tracks().slice(0, 10)));
  readonly isPreviewArtist = computed(() => this.ref().startsWith('itunes:'));

  private ref$ = toObservable(this.ref);
  private sub?: Subscription;

  ngOnInit(): void {
    // Re-load when navigating from one artist to another
    this.sub = this.ref$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.showAll.set(false);
        }),
        switchMap((ref) => this.musicApi.getArtistPage(ref))
      )
      .subscribe(({ artist, tracks }) => {
        this.artist.set(artist ?? (tracks[0] ? { ref: this.ref(), name: tracks[0].artist_name, image: tracks[0].image } : null));
        this.tracks.set(tracks);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  formatCount(n: number): string {
    return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n);
  }
}
