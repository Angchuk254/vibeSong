import { TestBed } from '@angular/core/testing';
import { AudioFxService } from './audio-fx.service';

describe('AudioFxService', () => {
  beforeEach(() => localStorage.clear());

  it('applies presets, marks manual changes as custom and remembers them', () => {
    const fx = TestBed.inject(AudioFxService);
    (fx as any).canEq = true;
    (fx as any).route = () => undefined;
    fx.setPreset('bass');
    expect(fx.eqOn()).toBe(true);
    expect(fx.gains()).toEqual([7, 4, 0, -1, 0]);
    fx.setGain(0, 40); // clamped
    expect(fx.gains()[0]).toBe(12);
    expect(fx.preset()).toBe('custom');
    const saved = JSON.parse(localStorage.getItem('vo_sound')!);
    expect(saved.gains[0]).toBe(12);
    expect(saved.eq).toBe(true);
  });

  it('turns crossfade off where volume cannot be changed', () => {
    const fx = TestBed.inject(AudioFxService);
    (fx as any).canFade = false;
    fx.setCrossfade(6);
    expect(fx.crossfade()).toBe(0);
  });
});
