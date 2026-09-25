// ============================================
// vibeOnly — Library Service (playlists)
// ============================================

import { Injectable, inject, signal } from '@angular/core';
import { Playlist, Track, ArtistSummary, Collection } from '../models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private storage = inject(StorageService);

  readonly playlists = signal<Playlist[]>(this.storage.getPlaylists());
  readonly followedArtists = signal<ArtistSummary[]>(this.storage.getFollowedArtists());
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

  /** Copy a public playlist/album into your own library */
  saveCollection(c: Collection, tracks: Track[]): Playlist {
    const existing = this.playlists().find((p) => p.description === `Saved from ${c.ref}`);
    if (existing) return existing;
    const playlist: Playlist = {
      id: `pl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: c.name,
      description: `Saved from ${c.ref}`,
      image: c.image || tracks[0]?.image || '',
      tracks,
      createdAt: '',
      updatedAt: '',
    };
    this.storage.savePlaylist(playlist);
    this.refresh();
    return playlist;
  }

  isCollectionSaved(ref: string): boolean {
    return this.playlists().some((p) => p.description === `Saved from ${ref}`);
  }

  /** Move a track within a playlist */
  moveTrack(playlistId: string, from: number, to: number): void {
    const pl = this.storage.getPlaylist(playlistId);
    if (!pl || to < 0 || to >= pl.tracks.length) return;
    const tracks = [...pl.tracks];
    const [t] = tracks.splice(from, 1);
    tracks.splice(to, 0, t);
    this.storage.savePlaylist({ ...pl, tracks });
    this.refresh();
  }

  // ── Artists ──

  isFollowing(ref: string): boolean {
    return this.followedArtists().some((a) => a.ref === ref);
  }

  toggleFollow(artist: ArtistSummary): boolean {
    const now = this.storage.toggleFollowArtist(artist);
    this.followedArtists.set(this.storage.getFollowedArtists());
    return now;
  }

  // ── Backup ──

  exportLibrary(): void {
    const blob = new Blob([this.storage.exportLibrary()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibeonly-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  importLibrary(json: string): { songs: number; playlists: number; artists: number } {
    const result = this.storage.importLibrary(json);
    this.refresh();
    this.followedArtists.set(this.storage.getFollowedArtists());
    return result;
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
