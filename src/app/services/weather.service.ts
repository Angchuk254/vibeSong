// ============================================
// YakBeats — Live weather + a music mood to match
// ============================================
// Current conditions from Open-Meteo (free, no key) for the place the Home
// greeting already knows (device location, else IP, else Leh). Checked every
// 10 minutes while the app is open and whenever you come back to it.

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { LocationService, Place } from './location.service';

export interface Weather {
  temp: number;
  feels: number;
  code: number;
  isDay: boolean;
  wind: number; // km/h
  humidity: number; // %
  precip: number; // mm in the last hour
  max?: number;
  min?: number;
  sunrise?: string; // local ISO time
  sunset?: string;
  /** The place's UTC offset in seconds */
  offset?: number;
  lat: number;
  lon: number;
  city: string;
  at: number;
}

export type Scene = 'sun' | 'night' | 'clouds' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherMood {
  /** "Light snow" */
  label: string;
  /** Bootstrap icon class */
  icon: string;
  /** "Snowing in Leh ❄️" */
  headline: string;
  /** One line of music advice */
  line: string;
  /** Category to play */
  categoryId: string;
  playLabel: string;
  scene: Scene;
}

const CACHE_KEY = 'vo_weather';
const FRESH_MS = 10 * 60 * 1000;

/** WMO weather code → words + icon + scene */
function describe(code: number, isDay: boolean): { label: string; icon: string; scene: Scene } {
  const sunOrMoon = isDay ? 'sun' : 'night';
  if (code === 0) return { label: isDay ? 'Clear sky' : 'Clear night', icon: isDay ? 'bi-sun-fill' : 'bi-moon-stars-fill', scene: sunOrMoon };
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'bi-sun-fill' : 'bi-moon-stars-fill', scene: sunOrMoon };
  if (code === 2) return { label: 'Partly cloudy', icon: isDay ? 'bi-cloud-sun-fill' : 'bi-cloud-moon-fill', scene: 'clouds' };
  if (code === 3) return { label: 'Overcast', icon: 'bi-clouds-fill', scene: 'clouds' };
  if (code === 45 || code === 48) return { label: 'Foggy', icon: 'bi-cloud-fog2-fill', scene: 'fog' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'bi-cloud-drizzle-fill', scene: 'rain' };
  if (code === 56 || code === 57) return { label: 'Freezing drizzle', icon: 'bi-cloud-sleet-fill', scene: 'rain' };
  if (code === 61) return { label: 'Light rain', icon: 'bi-cloud-rain-fill', scene: 'rain' };
  if (code === 63) return { label: 'Rain', icon: 'bi-cloud-rain-fill', scene: 'rain' };
  if (code === 65) return { label: 'Heavy rain', icon: 'bi-cloud-rain-heavy-fill', scene: 'rain' };
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'bi-cloud-sleet-fill', scene: 'rain' };
  if (code === 71) return { label: 'Light snow', icon: 'bi-cloud-snow-fill', scene: 'snow' };
  if (code === 73) return { label: 'Snow', icon: 'bi-cloud-snow-fill', scene: 'snow' };
  if (code === 75) return { label: 'Heavy snow', icon: 'bi-snow2', scene: 'snow' };
  if (code === 77) return { label: 'Snow grains', icon: 'bi-cloud-snow-fill', scene: 'snow' };
  if (code >= 80 && code <= 82) return { label: code === 82 ? 'Heavy showers' : 'Rain showers', icon: 'bi-cloud-rain-heavy-fill', scene: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'bi-cloud-snow-fill', scene: 'snow' };
  if (code >= 95) return { label: code === 95 ? 'Thunderstorm' : 'Thunderstorm & hail', icon: 'bi-cloud-lightning-rain-fill', scene: 'storm' };
  return { label: 'Weather', icon: 'bi-cloud-fill', scene: 'clouds' };
}

/** The local folk category for a place, if there is one */
function localCategory(p: Place | null): { id: string; name: string } | null {
  const r = `${p?.region || ''} ${p?.country || ''}`.toLowerCase();
  if (r.includes('ladakh')) return { id: 'ladakhi', name: 'Ladakhi' };
  if (r.includes('himachal')) return { id: 'himachali', name: 'Himachali' };
  if (r.includes('uttarakhand')) return { id: 'uttarakhand', name: 'Garhwali & Kumaoni' };
  if (r.includes('nepal')) return { id: 'nepal', name: 'Nepali' };
  if (r.includes('bhutan')) return { id: 'bhutan', name: 'Bhutanese' };
  if (r.includes('tibet')) return { id: 'tibet', name: 'Tibetan' };
  return null;
}

/** Minutes since midnight at the weather's place (falls back to the phone's clock) */
export function placeMinutes(w: Pick<Weather, 'offset'>, now = new Date()): number {
  if (w.offset == null) return now.getHours() * 60 + now.getMinutes();
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (((utc + Math.round(w.offset / 60)) % 1440) + 1440) % 1440;
}

/** Pick one line by day so it changes daily but not on every refresh */
function pick<T>(items: T[], salt = 0): T {
  const day = Math.floor(Date.now() / 86400000);
  return items[(day + salt) % items.length];
}

/** Weather + place + hour → what to listen to */
export function moodFor(w: Weather, place: Place | null, hour = new Date().getHours()): WeatherMood {
  const d = describe(w.code, w.isDay);
  const city = w.city || place?.city || 'your town';
  const local = localCategory(place);
  const base = { label: d.label, icon: d.icon, scene: d.scene };
  const late = hour >= 22 || hour < 5;

  switch (d.scene) {
    case 'snow':
      return {
        ...base,
        headline: `Snowing in ${city} ❄️`,
        line: pick([
          'Blanket on, butter tea in hand. Slow songs only.',
          'Snow outside, warm songs inside. Perfect window-seat weather.',
          'The mountains are going quiet. Match the mood.',
        ]),
        categoryId: local?.id || 'chill',
        playLabel: local ? `Cosy ${local.name}` : 'Cosy chill',
      };
    case 'storm':
      return {
        ...base,
        headline: `Thunder over ${city} ⛈️`,
        line: 'Stay in, turn it up and let the sky do the drums.',
        categoryId: 'rock',
        playLabel: 'Storm rock',
      };
    case 'rain':
      return {
        ...base,
        headline: `${d.label} in ${city} 🌧️`,
        line: pick([
          'Rain + chai + romantic songs. You know the drill.',
          'Window seat, raindrops, a slow playlist. Main-character hours.',
          'Pakoras optional, rain songs mandatory.',
        ]),
        categoryId: late ? 'sleep' : 'romance',
        playLabel: late ? 'Rainy night sleep' : 'Rain songs',
      };
    case 'fog':
      return {
        ...base,
        headline: `Foggy in ${city} 🌫️`,
        line: 'Can’t see far today. Keep it soft and dreamy.',
        categoryId: 'ambient',
        playLabel: 'Dreamy ambient',
      };
    default:
      break;
  }

  // Dry weather: temperature, wind and time of day set the mood
  if (w.temp <= 2) {
    return {
      ...base,
      headline: `${Math.round(w.temp)}° in ${city} 🥶`,
      line: 'Freezing out there. Warm up with some home-grown folk.',
      categoryId: local?.id || 'acoustic',
      playLabel: local ? `${local.name} warmers` : 'Warm acoustic',
    };
  }
  if (w.temp >= 33) {
    return {
      ...base,
      headline: `${Math.round(w.temp)}° in ${city} 🔥`,
      line: 'It’s a scorcher. Cold drink, loud summer bangers.',
      categoryId: 'party',
      playLabel: 'Summer bangers',
    };
  }
  if (w.wind >= 35) {
    return {
      ...base,
      headline: `Windy in ${city} 🌬️`,
      line: 'Wind in your hair energy. Roll the windows down.',
      categoryId: 'roadtrip',
      playLabel: 'Road-trip songs',
    };
  }
  if (!w.isDay || late) {
    return {
      ...base,
      headline: d.scene === 'clouds' ? `Cloudy night in ${city} ☁️` : `Starry night in ${city} ✨`,
      line: late ? 'The world is asleep. Soft songs for the quiet hours.' : 'Evening calm. Lights low, volume medium.',
      categoryId: late ? 'sleep' : 'lofi',
      playLabel: late ? 'Sleepy songs' : 'Evening lo-fi',
    };
  }
  if (d.scene === 'clouds') {
    return {
      ...base,
      headline: `${d.label} in ${city} ⛅`,
      line: 'Grey skies, easy beats. A good day to get stuff done.',
      categoryId: 'chill',
      playLabel: 'Cloudy chill',
    };
  }
  return {
    ...base,
    headline: `Sunny in ${city} ☀️`,
    line: pick([
      'Blue sky, full sun. Feel-good songs only.',
      'Sunglasses on. The sky is showing off today.',
      local ? `Sun on the peaks. Time for some ${local.name} sunshine.` : 'Perfect weather for a happy playlist.',
    ]),
    categoryId: local && hour < 12 ? local.id : 'happy',
    playLabel: local && hour < 12 ? `${local.name} morning` : 'Happy songs',
  };
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private location = inject(LocationService);

  readonly weather = signal<Weather | null>(this.cached());
  readonly loading = signal(false);
  readonly mood = computed(() => {
    const w = this.weather();
    this.tick();
    return w ? moodFor(w, this.location.place(), Math.floor(placeMinutes(w) / 60)) : null;
  });
  /** Changes every minute so "updated 3 min ago" and time-of-day moods stay right */
  readonly tick = signal(0);

  private inFlight: Promise<void> | null = null;

  constructor() {
    // New place → new weather
    effect(() => {
      const p = this.location.place();
      if (p) untracked(() => this.refresh());
    });
    setInterval(() => {
      this.tick.update((t) => t + 1);
      this.refresh();
    }, 60 * 1000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.refresh());
    window.addEventListener('online', () => this.refresh(true));
  }

  /** Fetch again if the reading is old or for somewhere else */
  refresh(force = false): Promise<void> {
    const place = this.location.place();
    if (!place || !this.location.enabled()) return Promise.resolve();
    const w = this.weather();
    const moved = w && place.lat != null && place.lon != null && (Math.abs(w.lat - place.lat) > 0.05 || Math.abs(w.lon - place.lon) > 0.05);
    const otherCity = w && place.lat == null && w.city !== place.city;
    const stale = !w || Date.now() - w.at > FRESH_MS;
    if (!force && !moved && !otherCity && !stale) return Promise.resolve();
    if (!this.inFlight) {
      this.inFlight = this.load(place).finally(() => (this.inFlight = null));
    }
    return this.inFlight;
  }

  /** "just now" / "4 min ago" */
  updatedAgo(): string {
    this.tick();
    const w = this.weather();
    if (!w) return '';
    const mins = Math.floor((Date.now() - w.at) / 60000);
    return mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`;
  }

  private async load(place: Place): Promise<void> {
    this.loading.set(true);
    try {
      let { lat, lon } = place;
      if (lat == null || lon == null) {
        // An older saved place without a position: look the city up
        const g = await firstValueFrom(
          this.http
            .get<any>(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(place.city)}`)
            .pipe(timeout(8000))
        );
        lat = g?.results?.[0]?.latitude;
        lon = g?.results?.[0]?.longitude;
        if (lat == null || lon == null) return;
      }
      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,precipitation',
        daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
        forecast_days: '1',
        timezone: 'auto',
      });
      const r = await firstValueFrom(this.http.get<any>(`https://api.open-meteo.com/v1/forecast?${params}`).pipe(timeout(10000)));
      const c = r?.current;
      if (!c || typeof c.temperature_2m !== 'number') return;
      const w: Weather = {
        temp: c.temperature_2m,
        feels: c.apparent_temperature ?? c.temperature_2m,
        code: c.weather_code ?? 0,
        isDay: c.is_day !== 0,
        wind: c.wind_speed_10m ?? 0,
        humidity: c.relative_humidity_2m ?? 0,
        precip: c.precipitation ?? 0,
        max: r.daily?.temperature_2m_max?.[0],
        min: r.daily?.temperature_2m_min?.[0],
        sunrise: r.daily?.sunrise?.[0],
        sunset: r.daily?.sunset?.[0],
        offset: typeof r.utc_offset_seconds === 'number' ? r.utc_offset_seconds : undefined,
        lat: Number(lat),
        lon: Number(lon),
        city: place.city,
        at: Date.now(),
      };
      this.weather.set(w);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(w));
      } catch {
        /* ignore */
      }
    } catch {
      /* offline or service down: keep the last reading */
    } finally {
      this.loading.set(false);
    }
  }

  private cached(): Weather | null {
    try {
      const w = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as Weather | null;
      // Older than 6 hours isn't worth showing
      return w && Date.now() - w.at < 6 * 3600 * 1000 ? w : null;
    } catch {
      return null;
    }
  }
}
