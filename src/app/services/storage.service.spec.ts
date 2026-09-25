import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { Track } from '../models';

const track = (id: string, extra: Partial<Track> = {}): Track => ({
  id, name: `Song ${id}`, artist_name: 'Artist', artist_id: '', album_name: '', album_id: '',
  album_image: '', duration: 180, audio: `https://x.test/${id}.mp3`, audiodownload: '', image: '',
  releasedate: '', position: 1, ...extra,
});

describe('StorageService', () => {
  beforeEach(() => localStorage.clear());

  it('keeps liked YouTube, device and radio songs with no duration at startup', () => {
    localStorage.setItem('vo_favorites', JSON.stringify([
      track('yt', { duration: 0, provider: 'youtube', audio: 'youtube:abcdefghijk' }),
      track('dev', { duration: 0, provider: 'device', audio: 'device:123' }),
      track('radio', { duration: 0, provider: 'radio', isLive: true }),
      track('ok'),
    ]));
    const favs = TestBed.inject(StorageService).getFavorites();
    expect(favs.map((t) => t.id)).toEqual(['yt', 'dev', 'radio', 'ok']);
  });

  it('removes songs from sources that no longer exist', () => {
    localStorage.setItem('vo_favorites', JSON.stringify([
      track('old', { provider: 'local' }),
      track('jam', { audio: 'https://j.test/a?format=VBR' }),
      track('ok'),
    ]));
    expect(TestBed.inject(StorageService).getFavorites().map((t) => t.id)).toEqual(['ok']);
  });

  it('toggles favorites', () => {
    const s = TestBed.inject(StorageService);
    expect(s.toggleFavorite(track('a'))).toBe(true);
    expect(s.isFavorite('a')).toBe(true);
    expect(s.toggleFavorite(track('a'))).toBe(false);
    expect(s.isFavorite('a')).toBe(false);
  });

  it('round-trips a backup and merges without duplicates', () => {
    const s = TestBed.inject(StorageService);
    s.toggleFavorite(track('a'));
    s.savePlaylist({ id: 'p1', name: 'Mix', description: '', image: '', tracks: [track('a')], createdAt: '', updatedAt: '' });
    s.toggleFollowArtist({ ref: 'audius:1', name: 'A', image: '' });
    const backup = s.exportLibrary();

    localStorage.clear();
    const fresh = TestBed.inject(StorageService);
    expect(fresh.importLibrary(backup)).toEqual({ songs: 1, playlists: 1, artists: 1 });
    // Importing again adds nothing new
    expect(fresh.importLibrary(backup)).toEqual({ songs: 0, playlists: 0, artists: 0 });
    expect(fresh.getPlaylists()[0].tracks.length).toBe(1);
  });

  it('rejects a file that is not a backup', () => {
    expect(() => TestBed.inject(StorageService).importLibrary('"hello"')).toThrow();
  });

  it('frees rebuildable caches and retries when storage is full', () => {
    const s = TestBed.inject(StorageService);
    localStorage.setItem('vo_youtube_cache', 'big');
    const real = Storage.prototype.setItem;
    let failures = 1;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'vo_favorites' && failures-- > 0) throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, k, v);
    });
    s.toggleFavorite(track('a'));
    spy.mockRestore();
    expect(s.isFavorite('a')).toBe(true);
    expect(localStorage.getItem('vo_youtube_cache')).toBeNull();
  });

  it('records plays for On Repeat and top artists', () => {
    const s = TestBed.inject(StorageService);
    s.recordPlay(track('a'));
    s.recordPlay(track('a'));
    s.recordPlay(track('b', { artist_name: 'Other' }));
    expect(s.getMostPlayed().map((t) => t.id)).toEqual(['a']);
    expect(s.getTopArtists()[0]).toMatchObject({ name: 'Artist', plays: 2 });
  });
});
