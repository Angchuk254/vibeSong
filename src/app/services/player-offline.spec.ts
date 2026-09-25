import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { PlayerService } from './player.service';
import { DeviceMusicService, DEVICE_PREFIX } from './device-music.service';
import { Track } from '../models';

const track = (id: string, audio = `https://x.test/${id}`): Track => ({
  id, name: id, artist_name: 'A', artist_id: '', album_name: '', album_id: '', album_image: '',
  duration: 100, audio, audiodownload: '', image: '', releasedate: '', position: 1,
});

describe('PlayerService (offline)', () => {
  let p: PlayerService;
  let device: DeviceMusicService;
  let online = true;
  let played: { id: string; at: number }[];
  const ids = () => p.queue().map((t) => t.id);
  const internals = () => p as any;

  beforeEach(() => {
    localStorage.clear();
    online = true;
    played = [];
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    p = TestBed.inject(PlayerService);
    device = TestBed.inject(DeviceMusicService);
    // Record what would play instead of touching real audio
    vi.spyOn(internals(), 'loadAndPlay').mockImplementation((...args: unknown[]) => {
      const t = args[0] as Track;
      internals().wantsToPlay = true;
      p.currentTrack.set(t);
      played.push({ id: t.id, at: (args[1] as number) || 0 });
    });
    vi.spyOn(internals(), 'stopMedia').mockImplementation(() => p.isPlaying.set(false));

    const q = ['a', 'b', 'c'].map((id) => track(id));
    p.queue.set(q);
    p.queueIndex.set(1);
    p.currentTrack.set(q[1]);
    p.currentTime.set(42);
    internals().wantsToPlay = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const goOffline = () => {
    online = false;
    internals().goOffline();
  };
  const comeBack = () => {
    online = true;
    internals().backOnline();
    vi.advanceTimersByTime(1600);
  };

  it('plays My Songs when offline, then resumes the online song where it stopped', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`), track('m2', `${DEVICE_PREFIX}2`), track('yt', 'yt:abc')]);
    goOffline();
    expect(p.offlineMode()).toBe(true);
    expect([...ids()].sort()).toEqual(['m1', 'm2']); // YouTube links need internet
    expect(played[0].id).toMatch(/^m[12]$/);

    comeBack();
    expect(p.offlineMode()).toBe(false);
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(p.queueIndex()).toBe(1);
    expect(played.at(-1)).toEqual({ id: 'b', at: 42 });
  });

  it('with no saved songs, waits and resumes automatically when back online', () => {
    goOffline();
    expect(p.offlineMode()).toBe(false);
    expect(played).toEqual([]);
    comeBack();
    expect(played).toEqual([{ id: 'b', at: 42 }]);
  });

  it('stays paused after reconnecting if you paused', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`)]);
    goOffline();
    internals().wantsToPlay = false; // paused the offline mix
    const before = played.length;
    comeBack();
    expect(played.length).toBe(before);
    expect(p.currentTrack()?.id).toBe('b');
    expect(ids()).toEqual(['a', 'b', 'c']);
  });

  it('does nothing when switched off, except resuming later', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`)]);
    p.setOfflineSwitch(false);
    goOffline();
    expect(p.offlineMode()).toBe(false);
    expect(played).toEqual([]);
    comeBack();
    expect(played).toEqual([{ id: 'b', at: 42 }]);
  });

  it('picking an online song yourself replaces the song to resume', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`)]);
    goOffline();
    p.playTrack(track('z'));
    expect(p.offlineMode()).toBe(false);
    expect(internals().resumeAfterOffline).toBeNull();
  });

  it('loops My Songs while still offline', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`)]);
    goOffline();
    p.playNext(true);
    expect(played.at(-1)?.id).toBe('m1');
    expect(p.offlineMode()).toBe(true);
  });

  it('when the queue runs out offline, plays My Songs and finds more music once back', () => {
    device.tracks.set([track('m1', `${DEVICE_PREFIX}1`)]);
    p.queueIndex.set(2);
    p.currentTrack.set(p.queue()[2]);
    const more = vi.spyOn(internals(), 'extendWithSimilar').mockImplementation(() => undefined);
    online = false;
    p.playNext(true);
    expect(p.offlineMode()).toBe(true);
    expect(more).not.toHaveBeenCalled();
    comeBack();
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(more).toHaveBeenCalledWith(true);
  });
});
