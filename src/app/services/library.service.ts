// ============================================
// vibeOnly — Library Service (playlists)
// ============================================

import { Injectable, inject, signal } from '@angular/core';
import { Playlist, Track, ArtistSummary, Collection } from '../models';
import { StorageService } from './storage.service';
import { DeviceMusicService } from './device-music.service';
import { YouTubeService } from './youtube.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private storage = inject(StorageService);
  private device = inject(DeviceMusicService);

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

  /** Downloads a backup; returns how many local audio files it could NOT include */
  async exportLibrary(): Promise<number> {
    await this.device.ready;
    const mine = this.device.tracks();
    const data = JSON.parse(this.storage.exportLibrary());
    // YouTube songs are just links, so they travel in the backup; audio files are too big
    data.mySongs = mine
      .filter((t) => t.provider === 'youtube')
      .map((t) => ({ id: YouTubeService.idOf(t), title: t.name, artist: t.artist_name, thumb: t.image, category: t.category }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibeonly-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return mine.filter((t) => t.provider === 'device').length;
  }

  async importLibrary(json: string): Promise<{ songs: number; playlists: number; artists: number; mySongs: number }> {
    const result = this.storage.importLibrary(json);
    let mySongs = 0;
    const list = (JSON.parse(json).mySongs || []) as { id: string; title: string; artist: string; thumb: string; category: string }[];
    const byCat = new Map<string, typeof list>();
    list.filter((s) => s?.id && /^[\w-]{11}$/.test(s.id)).forEach((s) => byCat.set(s.category || 'ladakhi', [...(byCat.get(s.category || 'ladakhi') || []), s]));
    for (const [cat, songs] of byCat) {
      mySongs += await this.device.addYouTube(songs.map((s) => ({ id: s.id, title: s.title, artist: s.artist, thumb: s.thumb })), cat);
    }
    this.refresh();
    this.followedArtists.set(this.storage.getFollowedArtists());
    return { ...result, mySongs };
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
