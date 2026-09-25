// ============================================
// vibeOnly — Add-to-playlist sheet
// ============================================

import { Component, HostListener, inject, signal } from '@angular/core';
import { LibraryService } from '../../services';

@Component({
  selector: 'app-playlist-picker',
  standalone: true,
  template: `
    @if (library.pickerTrack(); as track) {
      <button type="button" class="pp-backdrop" aria-label="Close" (click)="library.closePicker()"></button>
      <div class="pp-sheet" role="dialog" aria-modal="true" aria-label="Add to playlist">
        <header>
          <img [src]="track.album_image || track.image || 'icons/icon-192x192.png'" alt="" />
          <div>
            <h3>Add to playlist</h3>
            <p>{{ track.name }} · {{ track.artist_name }}</p>
          </div>
          <button class="pp-close" (click)="library.closePicker()" aria-label="Close"><i class="bi bi-x-lg"></i></button>
        </header>

        <form class="pp-new" (submit)="create($event)">
          <input #name type="text" placeholder="New playlist name" maxlength="60"
                 [value]="newName()" (input)="newName.set(name.value)" />
          <button type="submit" [disabled]="!newName().trim()"><i class="bi bi-plus-lg"></i> Create</button>
        </form>

        <div class="pp-list">
          @for (pl of library.playlists(); track pl.id) {
            <button class="pp-item" (click)="add(pl.id)" [disabled]="has(pl.id)">
              <span class="pp-thumb">
                @if (pl.image) { <img [src]="pl.image" alt="" /> } @else { <i class="bi bi-music-note-list"></i> }
              </span>
              <span class="pp-name">{{ pl.name }}<small>{{ pl.tracks.length }} songs</small></span>
              @if (has(pl.id)) { <i class="bi bi-check-circle-fill pp-check"></i> }
            </button>
          } @empty {
            <p class="pp-empty">No playlists yet — name one above.</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .pp-backdrop { position: fixed; inset: 0; border: none; padding: 0; cursor: default; background: rgba(0,0,0,0.55); z-index: 4000; animation: fade .15s; }
    .pp-sheet {
      position: fixed; z-index: 4001; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(420px, calc(100vw - 32px)); max-height: min(560px, calc(100dvh - 48px));
      display: flex; flex-direction: column; gap: 14px; padding: 18px;
      background: var(--vo-bg-secondary); border: 1px solid var(--vo-border-light);
      border-radius: var(--vo-radius-lg); box-shadow: var(--vo-shadow-lg);
    }
    header { display: flex; align-items: center; gap: 12px;
      img { width: 48px; height: 48px; border-radius: var(--vo-radius-sm); object-fit: cover; }
      div { flex: 1; min-width: 0; }
      h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
      p { margin: 2px 0 0; font-size: 0.8rem; color: var(--vo-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .pp-close { background: none; border: none; color: var(--vo-text-secondary); font-size: 1rem; padding: 6px; cursor: pointer; }
    .pp-new { display: flex; gap: 8px;
      input { flex: 1; min-width: 0; height: 40px; padding: 0 12px; border-radius: var(--vo-radius-md);
        border: 1px solid var(--vo-border-light); background: var(--vo-bg-input); color: var(--vo-text-primary); outline: none;
        &:focus { border-color: var(--vo-accent); } }
      button { border: none; border-radius: var(--vo-radius-md); padding: 0 14px; background: var(--vo-accent); color: #fff; font-weight: 600; cursor: pointer;
        &:disabled { opacity: .45; cursor: default; } }
    }
    .pp-list { overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
    .pp-item { display: flex; align-items: center; gap: 12px; padding: 8px; border: none; background: none; color: var(--vo-text-primary);
      border-radius: var(--vo-radius-md); text-align: left; cursor: pointer;
      &:hover:not(:disabled) { background: var(--vo-bg-input); }
      &:disabled { cursor: default; opacity: .7; } }
    .pp-thumb { width: 42px; height: 42px; border-radius: var(--vo-radius-sm); overflow: hidden; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; background: var(--vo-gradient-accent); color: #fff;
      img { width: 100%; height: 100%; object-fit: cover; } }
    .pp-name { flex: 1; min-width: 0; font-weight: 600; font-size: 0.9rem; display: flex; flex-direction: column;
      small { font-weight: 400; font-size: 0.75rem; color: var(--vo-text-muted); } }
    .pp-check { color: var(--vo-secondary); }
    .pp-empty { color: var(--vo-text-muted); font-size: 0.85rem; text-align: center; padding: 16px 0; margin: 0; }
    @keyframes fade { from { opacity: 0; } }
  `],
})
export class PlaylistPickerComponent {
  readonly library = inject(LibraryService);
  readonly newName = signal('');

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.library.closePicker();
  }

  has(playlistId: string): boolean {
    const t = this.library.pickerTrack();
    return !!t && !!this.library.getPlaylist(playlistId)?.tracks.some((x) => x.id === t.id);
  }

  add(playlistId: string): void {
    const t = this.library.pickerTrack();
    if (t) this.library.addTrack(playlistId, t);
    this.library.closePicker();
  }

  create(e: Event): void {
    e.preventDefault();
    const t = this.library.pickerTrack();
    if (!this.newName().trim()) return;
    this.library.createPlaylist(this.newName(), t ?? undefined);
    this.newName.set('');
    this.library.closePicker();
  }
}
