// ============================================
// vibeOnly — Library Service (playlists)
// ============================================

import { Injectable, inject, signal } from '@angular/core';
import { Playlist, Track } from '../models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private storage = inject(StorageService);

  readonly playlists = signal<Playlist[]>(this.storage.getPlaylists());
  /** Track waiting to be added to a playlist (opens the picker) */
  readonly pickerTrack = signal<Track | null>(null);

  createPlaylist(name: string, firstTrack?: Track): Playlist {
    const playlist: Playlist = {
      id: `pl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || 'My Playlist',
      description: '',
      image: firstTrack?.album_image || firstTrack?.image || '',
      tracks: firstTrack ? [firstTrack] : [],
      createdAt: '',
      updatedAt: '',
    };
    this.storage.savePlaylist(playlist);
    this.refresh();
    return playlist;
  }

  renamePlaylist(id: string, name: string): void {
    const pl = this.storage.getPlaylist(id);
    if (!pl || !name.trim()) return;
    this.storage.savePlaylist({ ...pl, name: name.trim() });
    this.refresh();
  }

  deletePlaylist(id: string): void {
    this.storage.deletePlaylist(id);
    this.refresh();
  }

  addTrack(playlistId: string, track: Track): void {
    const pl = this.storage.getPlaylist(playlistId);
    if (!pl || pl.tracks.some((t) => t.id === track.id)) return;
    this.storage.savePlaylist({
      ...pl,
      image: pl.image || track.album_image || track.image,
      tracks: [...pl.tracks, track],
    });
    this.refresh();
  }

  removeTrack(playlistId: string, trackId: string): void {
    this.storage.removeTrackFromPlaylist(playlistId, trackId);
    this.refresh();
  }

  getPlaylist(id: string): Playlist | undefined {
    return this.playlists().find((p) => p.id === id);
  }

  openPicker(track: Track): void {
    this.pickerTrack.set(track);
  }

  closePicker(): void {
    this.pickerTrack.set(null);
  }

  private refresh(): void {
    this.playlists.set(this.storage.getPlaylists());
  }
}
