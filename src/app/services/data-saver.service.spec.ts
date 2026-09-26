import { TestBed } from '@angular/core/testing';
import { DataSaverService, estimateKbps } from './data-saver.service';
import { Track } from '../models';

const t = (over: Partial<Track>): Track => ({
  id: 'x', name: 'x', artist_name: '', artist_id: '', album_name: '', album_id: '', album_image: '', duration: 0,
  audio: 'https://a/x', audiodownload: '', image: '', releasedate: '', position: 1, ...over,
});

describe('DataSaverService', () => {
  beforeEach(() => localStorage.clear());

  it('shrinks cover pictures only while on', () => {
    const s = TestBed.inject(DataSaverService);
    const audius = 'https://creatornode.audius.co/content/abc/480x480.jpg';
    const itunes = 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg';
    s.setMode('off');
    expect(s.art(audius)).toBe(audius);
    s.setMode('on');
    expect(s.art(audius)).toBe('https://creatornode.audius.co/content/abc/150x150.jpg');
    expect(s.art(itunes)).toBe('https://is1-ssl.mzstatic.com/image/thumb/x/200x200bb.jpg');
    expect(s.art('icons/icon-192x192.png')).toBe('icons/icon-192x192.png');
  });

  it('puts light radio streams first when on', () => {
    const s = TestBed.inject(DataSaverService);
    const list = [t({ id: 'a', bitrate: 320 }), t({ id: 'b', bitrate: 64 }), t({ id: 'c' })];
    s.setMode('off');
    expect(s.preferLight(list).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    s.setMode('on');
    expect(s.preferLight(list).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('remembers the mode and counts data per day', () => {
    const s = TestBed.inject(DataSaverService);
    s.setMode('on');
    expect(localStorage.getItem('vo_data_saver')).toBe('on');
    s.addBytes(5 * 1024 * 1024);
    s.addBytes(1024 * 1024);
    const today = s.today();
    expect(today.mobile + today.wifi + today.unknown).toBe(6 * 1024 * 1024);
    s.persist();
    expect(JSON.parse(localStorage.getItem('vo_data_usage')!).length).toBe(1);
    expect(DataSaverService.format(6 * 1024 * 1024)).toBe('6.0 MB');
  });

  it('estimates stream sizes', () => {
    expect(estimateKbps(t({ audio: 'device:1' }), false, false)).toBe(0);
    expect(estimateKbps(t({ isLive: true, bitrate: 64 }), false, false)).toBe(64);
    expect(estimateKbps(t({}), true, false)).toBeGreaterThan(estimateKbps(t({}), true, true));
  });
});
