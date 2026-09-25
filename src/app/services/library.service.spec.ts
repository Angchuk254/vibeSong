import { TestBed } from '@angular/core/testing';
import { LibraryService } from './library.service';
import { Track } from '../models';

const track = (id: string): Track => ({
  id, name: id, artist_name: 'A', artist_id: '', album_name: '', album_id: '', album_image: '',
  duration: 100, audio: `https://x.test/${id}`, audiodownload: '', image: '', releasedate: '', position: 1,
});

describe('LibraryService (playlists)', () => {
  let lib: LibraryService;
  beforeEach(() => {
    localStorage.clear();
    lib = TestBed.inject(LibraryService);
  });

  it('creates a playlist and keeps it after a restart', () => {
    const pl = lib.createPlaylist('Road Trip', track('a'));
    lib.addTrack(pl.id, track('b'));
    lib.addTrack(pl.id, track('b')); // duplicate ignored
    TestBed.resetTestingModule();
    const again = TestBed.inject(LibraryService);
    expect(again.getPlaylist(pl.id)?.tracks.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('reorders, removes, renames and deletes', () => {
    const pl = lib.createPlaylist('Mix');
    ['a', 'b', 'c'].forEach((id) => lib.addTrack(pl.id, track(id)));
    lib.moveTrack(pl.id, 2, 0);
    expect(lib.getPlaylist(pl.id)?.tracks.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    lib.removeTrack(pl.id, 'a');
    lib.renamePlaylist(pl.id, 'Renamed');
    expect(lib.getPlaylist(pl.id)).toMatchObject({ name: 'Renamed' });
    expect(lib.getPlaylist(pl.id)?.tracks.map((t) => t.id)).toEqual(['c', 'b']);
    lib.deletePlaylist(pl.id);
    expect(lib.getPlaylist(pl.id)).toBeUndefined();
  });

  it('saves a public playlist only once', () => {
    const c = { ref: 'audius:p1', name: 'Chill', owner: 'x', image: '' };
    const first = lib.saveCollection(c, [track('a')]);
    const second = lib.saveCollection(c, [track('a')]);
    expect(second.id).toBe(first.id);
    expect(lib.isCollectionSaved('audius:p1')).toBe(true);
    expect(lib.playlists().length).toBe(1);
  });

  it('follows and unfollows artists', () => {
    const a = { ref: 'audius:1', name: 'Singer', image: '' };
    expect(lib.toggleFollow(a)).toBe(true);
    expect(lib.isFollowing('audius:1')).toBe(true);
    expect(lib.toggleFollow(a)).toBe(false);
  });
});
