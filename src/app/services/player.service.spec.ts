import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PlayerService } from './player.service';
import { Track } from '../models';

const track = (id: string): Track => ({
  id, name: id, artist_name: 'A', artist_id: '', album_name: '', album_id: '', album_image: '',
  duration: 100, audio: `https://x.test/${id}`, audiodownload: '', image: '', releasedate: '', position: 1,
});

describe('PlayerService (queue)', () => {
  let p: PlayerService;
  const ids = () => p.queue().map((t) => t.id);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    p = TestBed.inject(PlayerService);
    const q = ['a', 'b', 'c', 'd', 'e'].map(track);
    p.queue.set(q);
    p.queueIndex.set(1);
    p.currentTrack.set(q[1]);
  });

  it('inserts "play next" right after the current song', () => {
    p.playNextInQueue(track('x'));
    expect(ids()).toEqual(['a', 'b', 'x', 'c', 'd', 'e']);
    expect(p.queueIndex()).toBe(1);
  });

  it('moves the current song and keeps pointing at it', () => {
    p.moveInQueue(1, 1);
    expect(ids()).toEqual(['a', 'c', 'b', 'd', 'e']);
    expect(p.queueIndex()).toBe(2);
  });

  it('removes songs before the current one without losing its place', () => {
    p.removeFromQueue(0);
    expect(ids()).toEqual(['b', 'c', 'd', 'e']);
    expect(p.queueIndex()).toBe(0);
    p.removeFromQueue(0); // the current song can't be removed
    expect(ids()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('shuffles only what comes next and restores the order after', () => {
    p.toggleShuffle();
    expect(ids().slice(0, 2)).toEqual(['a', 'b']);
    expect([...ids()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    p.toggleShuffle();
    expect(ids()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(p.queueIndex()).toBe(1);
  });

  it('does not add duplicates to the queue', () => {
    p.addToQueue([track('c'), track('z')]);
    expect(ids()).toEqual(['a', 'b', 'c', 'd', 'e', 'z']);
  });

  it('clear keeps only the current song', () => {
    p.clearQueue();
    expect(ids()).toEqual(['b']);
    expect(p.queueIndex()).toBe(0);
  });

  it('cycles repeat modes and remembers the choice', () => {
    p.cycleRepeat();
    expect(p.repeatMode()).toBe('one');
    p.cycleRepeat();
    expect(p.repeatMode()).toBe('all');
    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('vo_player_prefs')!).repeat).toBe('all');
  });
});
