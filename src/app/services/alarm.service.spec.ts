import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AlarmService } from './alarm.service';

describe('AlarmService', () => {
  let a: AlarmService;
  let played: number;
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // A Wednesday, 06:29:30
    vi.setSystemTime(new Date(2026, 8, 23, 6, 29, 30));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    a = TestBed.inject(AlarmService);
    played = 0;
    vi.spyOn(a, 'play').mockImplementation(async () => (played++, true));
    vi.spyOn(a as any, 'playChime').mockImplementation(() => undefined);
    vi.spyOn(a as any, 'notify').mockImplementation(async () => undefined);
    vi.spyOn(a as any, 'askForNotifications').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rings at the set time, once', async () => {
    a.save({ time: '06:30', days: [], source: { kind: 'category', id: 'radio-himalayan' }, gentle: false });
    expect(a.countdown()).toBe('1 min');
    await vi.advanceTimersByTimeAsync(20000);
    expect(a.ringing()).toBe(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(a.ringing()).toBe(true);
    expect(played).toBe(1);
    // One-off alarm switches itself off
    expect(a.alarm()!.enabled).toBe(false);
    a.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(a.ringing()).toBe(false);
    expect(played).toBe(1);
  });

  it('does not ring straight away when set for a moment ago', async () => {
    const earlier = hhmm(new Date(Date.now() - 2 * 60000));
    a.save({ time: earlier, days: [0, 1, 2, 3, 4, 5, 6], source: { kind: 'liked' }, gentle: false });
    await vi.advanceTimersByTimeAsync(30000);
    expect(a.ringing()).toBe(false);
    expect(a.nextRing()!.getDate()).toBe(24); // tomorrow
  });

  it('skips days that are not selected', async () => {
    a.save({ time: '06:30', days: [0, 6], source: { kind: 'liked' }, gentle: false }); // weekends only
    await vi.advanceTimersByTimeAsync(120000);
    expect(a.ringing()).toBe(false);
    expect(a.nextRing()!.getDay()).toBe(6);
  });

  it('snoozes for 9 minutes', async () => {
    a.save({ time: '06:30', days: [3], source: { kind: 'liked' }, gentle: false });
    await vi.advanceTimersByTimeAsync(40000);
    expect(a.ringing()).toBe(true);
    a.snooze();
    expect(a.ringing()).toBe(false);
    await vi.advanceTimersByTimeAsync(8 * 60000);
    expect(a.ringing()).toBe(false);
    await vi.advanceTimersByTimeAsync(70000);
    expect(a.ringing()).toBe(true);
    expect(played).toBe(2);
  });

  it('plays the chime when the music cannot start', async () => {
    (a.play as any).mockImplementation(async () => false);
    a.save({ time: '06:30', days: [], source: { kind: 'category', id: 'radio-nepal' }, gentle: false });
    await vi.advanceTimersByTimeAsync(40000);
    await vi.advanceTimersByTimeAsync(1000);
    expect((a as any).playChime).toHaveBeenCalled();
  });
});
