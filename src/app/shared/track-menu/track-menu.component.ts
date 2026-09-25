// ============================================
// YakBeats — Track "more" menu
// ============================================

import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';
import { BackService } from '../../services/back.service';
import { Track } from '../../models';
import { PlayerService, LibraryService, MusicApiService } from '../../services';

@Component({
  selector: 'app-track-menu',
  standalone: true,
  template: `
    <button class="tm-btn" type="button" aria-label="More options" [attr.aria-expanded]="open()"
            (click)="toggle($event)" (keydown.enter)="$event.stopPropagation()" (keydown.space)="$event.stopPropagation()">
      <i class="bi bi-three-dots"></i>
    </button>
    @if (open()) {
      <div class="tm-menu" role="menu" tabindex="-1" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <button role="menuitem" (click)="playNext()"><i class="bi bi-arrow-return-right"></i> Play next</button>
        <button role="menuitem" (click)="addToQueue()"><i class="bi bi-list-ul"></i> Add to queue</button>
        <button role="menuitem" (click)="addToPlaylist()"><i class="bi bi-plus-square"></i> Add to playlist</button>
        @if (track().artistRef) {
          <button role="menuitem" (click)="goToArtist()"><i class="bi bi-person"></i> Go to artist</button>
        }
        @if (track().isPreview) {
          <a role="menuitem" [href]="youtube()" target="_blank" rel="noopener" (click)="close()"><i class="bi bi-youtube"></i> Full song on YouTube</a>
          @if (track().externalUrl) {
            <a role="menuitem" [href]="track().externalUrl" target="_blank" rel="noopener" (click)="close()"><i class="bi bi-apple"></i> Full song on Apple Music</a>
          }
        }
        <button role="menuitem" (click)="like()">
          <i class="bi" [class.bi-heart-fill]="player.isFavorite(track().id)" [class.bi-heart]="!player.isFavorite(track().id)"></i>
          {{ player.isFavorite(track().id) ? 'Remove from Liked' : 'Save to Liked Songs' }}
        </button>
        @if (removable()) {
          <button role="menuitem" class="danger" (click)="remove.emit(track()); close()"><i class="bi bi-trash3"></i> Remove from this playlist</button>
        }
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .tm-btn {
      background: none; border: none; color: var(--vo-text-muted);
      padding: 6px 8px; border-radius: 50%; cursor: pointer; font-size: 1rem; line-height: 1;
      &:hover, &[aria-expanded="true"] { color: var(--vo-text-primary); background: var(--vo-bg-input); }
    }
    .tm-menu {
      position: absolute; right: 0; top: calc(100% + 4px); z-index: 3000;
      min-width: 210px; padding: 6px; border-radius: var(--vo-radius-md);
      background: var(--vo-bg-card); border: 1px solid var(--vo-border-light);
      box-shadow: var(--vo-shadow-lg); display: flex; flex-direction: column;
      animation: tmIn 0.12s ease;
      button, a {
        display: flex; align-items: center; gap: 10px; width: 100%; text-decoration: none;
        background: none; border: none; color: var(--vo-text-primary);
        padding: 9px 10px; border-radius: var(--vo-radius-sm); font-size: 0.85rem; text-align: left; cursor: pointer;
        &:hover { background: var(--vo-bg-input); }
        i { width: 16px; color: var(--vo-text-secondary); }
        .bi-heart-fill { color: #ff6b6b; }
        &.danger, &.danger i { color: #ff6b6b; }
      }
    }
    @keyframes tmIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  `],
})
export class TrackMenuComponent {
  readonly track = input.required<Track>();
  readonly removable = input(false);
  readonly remove = output<Track>();

  readonly player = inject(PlayerService);
  private library = inject(LibraryService);
  private host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);

  private back = inject(BackService);

  constructor() {
    this.back.bind(this.open, () => this.open.set(false));
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.open.set(false);
  }

  toggle(e: Event): void {
    e.stopPropagation();
    this.open.update((v) => !v);
  }

  goToArtist(): void {
    const ref = this.track().artistRef;
    this.close();
    if (ref) this.back.navigate(['/artist', ref]);
  }

  youtube(): string {
    return MusicApiService.youtubeUrl(this.track());
  }

  playNext(): void {
    this.player.playNextInQueue(this.track());
    this.close();
  }

  addToQueue(): void {
    this.player.addToQueue([this.track()]);
    this.close();
  }

  addToPlaylist(): void {
    this.library.openPicker(this.track());
    this.close();
  }

  like(): void {
    this.player.toggleFavorite(this.track());
    this.close();
  }
}
