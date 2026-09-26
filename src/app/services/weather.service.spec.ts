import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Weather, WeatherService, moodFor, placeMinutes } from './weather.service';
import { LocationService, Place } from './location.service';

const leh: Place = { city: 'Leh', region: 'Ladakh', country: 'India', countryCode: 'IN', lat: 34.16, lon: 77.58 };
const w = (over: Partial<Weather>): Weather => ({
  temp: 15, feels: 14, code: 0, isDay: true, wind: 5, humidity: 40, precip: 0, lat: 34.16, lon: 77.58, city: 'Leh', at: Date.now(), ...over,
});

describe('moodFor', () => {
  it('snow in Ladakh plays Ladakhi songs', () => {
    const m = moodFor(w({ code: 73, temp: -4 }), leh, 10);
    expect(m.scene).toBe('snow');
    expect(m.label).toBe('Snow');
    expect(m.headline).toContain('Snowing in Leh');
    expect(m.categoryId).toBe('ladakhi');
  });

  it('rain means rain songs, or sleep late at night', () => {
    expect(moodFor(w({ code: 63 }), leh, 17).categoryId).toBe('romance');
    expect(moodFor(w({ code: 63 }), leh, 23).categoryId).toBe('sleep');
  });

  it('storms, fog, heat, cold and wind each have their own mood', () => {
    expect(moodFor(w({ code: 95 }), leh, 12).categoryId).toBe('rock');
    expect(moodFor(w({ code: 45 }), leh, 12).scene).toBe('fog');
    expect(moodFor(w({ code: 0, temp: 38 }), null, 14).categoryId).toBe('party');
    expect(moodFor(w({ code: 0, temp: -2 }), leh, 14).categoryId).toBe('ladakhi');
    expect(moodFor(w({ code: 0, wind: 50 }), null, 14).categoryId).toBe('roadtrip');
  });

  it('clear nights are starry and calm', () => {
    const m = moodFor(w({ code: 0, isDay: false }), leh, 20);
    expect(m.scene).toBe('night');
    expect(m.icon).toBe('bi-moon-stars-fill');
    expect(m.categoryId).toBe('lofi');
  });
});

describe('placeMinutes', () => {
  it('uses the place’s UTC offset', () => {
    const now = new Date(Date.UTC(2026, 0, 1, 1, 0)); // 01:00 UTC
    expect(placeMinutes({ offset: 19800 }, now)).toBe(6 * 60 + 30); // IST 06:30
    expect(placeMinutes({ offset: -18000 }, now)).toBe(20 * 60); // UTC-5 → 20:00 previous day
  });
});

describe('WeatherService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });

  it('fetches current weather for the detected place', async () => {
    const loc = TestBed.inject(LocationService);
    loc.place.set(leh);
    const svc = TestBed.inject(WeatherService);
    const http = TestBed.inject(HttpTestingController);
    const done = svc.refresh(true);
    const req = http.expectOne((r) => r.url.startsWith('https://api.open-meteo.com/v1/forecast'));
    expect(req.request.url).toContain('latitude=34.16');
    req.flush({
      utc_offset_seconds: 19800,
      current: { temperature_2m: -3.4, apparent_temperature: -8, relative_humidity_2m: 55, is_day: 1, weather_code: 71, wind_speed_10m: 12, precipitation: 0.2 },
      daily: { temperature_2m_max: [1], temperature_2m_min: [-9], sunrise: ['2026-01-01T07:30'], sunset: ['2026-01-01T17:40'] },
    });
    await done;
    expect(svc.weather()!.temp).toBe(-3.4);
    expect(svc.mood()!.headline).toContain('Snowing in Leh');
    expect(JSON.parse(localStorage.getItem('vo_weather')!).code).toBe(71);
  });

  it('looks up a saved city that has no position yet', async () => {
    const loc = TestBed.inject(LocationService);
    loc.place.set({ city: 'Kaza', region: 'Himachal Pradesh', country: 'India', countryCode: 'IN' });
    const svc = TestBed.inject(WeatherService);
    const http = TestBed.inject(HttpTestingController);
    const done = svc.refresh(true);
    http.expectOne((r) => r.url.includes('geocoding-api.open-meteo.com') && r.url.includes('Kaza')).flush({ results: [{ latitude: 32.22, longitude: 78.07 }] });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r));
    http.expectOne((r) => r.url.includes('latitude=32.22')).flush({ current: { temperature_2m: 5, weather_code: 3, is_day: 1 } });
    await done;
    expect(svc.mood()!.label).toBe('Overcast');
  });
});
