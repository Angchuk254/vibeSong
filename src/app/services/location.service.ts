// ============================================
// YakBeats — Location (for the Home greeting)
// ============================================
// Fully automatic, in this order:
// 1. Device location (GPS) — asked for automatically on app start while the
//    user hasn't answered; used silently once allowed.
// 2. IP address — when location is blocked or unavailable (approximate:
//    mobile networks often route through another state).
// 3. Leh, Ladakh — the default when neither works (also shown instantly
//    while detecting on first run).
// Re-checked on every app start / refresh and every hour, because people
// move. Only the city and a rough (≈1 km) position for the weather are kept
// on-device; can be turned off.

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { notify } from './storage.service';

export interface Place {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  /** 'gps' = device location, 'ip' = internet connection, 'default' = fallback */
  source?: 'gps' | 'ip' | 'default';
  /** Rough position (2 decimals ≈ 1 km), for the weather */
  lat?: number;
  lon?: number;
}

/** Shown while detecting, and when neither GPS nor IP works */
export const DEFAULT_PLACE: Place = { city: 'Leh', region: 'Ladakh', country: 'India', countryCode: 'IN', source: 'default', lat: 34.16, lon: 77.58 };

const CACHE_KEY = 'vo_location';
const ENABLED_KEY = 'vo_show_location';
const DENIED_KEY = 'vo_geo_denied';
/** How long a city is trusted before checking again */
export const LOCATION_TTL = 60 * 60 * 1000;
const TTL = LOCATION_TTL;

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);

  readonly enabled = signal(this.read<boolean>(ENABLED_KEY) !== false);
  readonly place = signal<Place | null>(this.enabled() ? this.cached() || this.read<Place>(CACHE_KEY) || DEFAULT_PLACE : null);
  /** True while waiting for the device location / permission prompt */
  readonly locating = signal(false);
  /** The user blocked location access (we then stick to the IP city) */
  readonly denied = signal(this.read<boolean>(DENIED_KEY) === true);

  private loading: Promise<void> | null = null;
  private watching = false;
  /** Each app start / page refresh looks up the location again */
  private checkedThisLoad = false;

  /** Device location is possible here (HTTPS + supported browser) */
  get canUseDevice(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator && (typeof isSecureContext === 'undefined' || isSecureContext);
  }

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    this.write(ENABLED_KEY, on);
    if (!on) {
      this.place.set(null);
      this.remove(CACHE_KEY);
    } else {
      this.refresh();
    }
  }

  /**
   * Get the city: cached if fresh, otherwise IP first (instant) and then the
   * device location (asks permission the first time).
   */
  refresh(): Promise<void> {
    if (!this.enabled()) return Promise.resolve();
    this.watch();
    if (!this.loading) {
      this.loading = this.run().finally(() => (this.loading = null));
    }
    return this.loading;
  }

  /** "Leh, Ladakh" / "Kathmandu, Nepal" */
  label(p: Place | null = this.place()): string {
    if (!p?.city) return p?.country || '';
    const second = p.countryCode === 'IN' ? p.region : p.country;
    return second && second !== p.city ? `${p.city}, ${second}` : p.city;
  }

  // ── Internals ──

  /** Check again every hour while open, and when the app returns to the foreground */
  private watch(): void {
    if (this.watching || typeof window === 'undefined') return;
    this.watching = true;
    const checkIfStale = () => {
      if (this.enabled() && !this.cached()) this.refresh();
    };
    setInterval(checkIfStale, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkIfStale();
    });
    window.addEventListener('online', checkIfStale);
  }

  private async run(): Promise<void> {
    const fresh = this.cached();
    if (fresh && this.checkedThisLoad) {
      this.place.set(fresh);
      return;
    }
    const isAppStart = !this.checkedThisLoad;
    this.checkedThisLoad = true;

    // Keep showing the last known city (or Leh) while we look again — no flicker
    const previous = this.place() || this.read<Place>(CACHE_KEY) || DEFAULT_PLACE;
    this.place.set(previous);

    // 1. Device location
    const permission = this.canUseDevice ? await this.permission() : 'denied';
    if (permission === 'granted') {
      // Allowed (maybe later, in the phone's settings): forget any old refusal
      this.denied.set(false);
      this.remove(DENIED_KEY);
    }
    const mayAsk = isAppStart && !this.denied() && (permission === 'prompt' || permission === 'unknown');
    if (permission === 'granted' || mayAsk) {
      const gps = await this.fromDevice();
      if (gps) return this.update(gps, previous);
    }

    // 2. IP address
    const ip = await this.fromIp();
    if (ip) return this.update(ip, previous);

    // 3. Default
    if (!previous || previous.source === 'default') this.update(DEFAULT_PLACE, null);
  }

  /** Save the new place and say so if the city changed */
  private update(p: Place, previous: Place | null): void {
    if (!this.enabled()) return;
    this.save(p);
    const real = (x: Place | null) => !!x?.city && x.source !== 'default';
    if (real(previous) && real(p) && previous!.city.toLowerCase() !== p.city.toLowerCase()) {
      notify(`📍 New spot unlocked: now vibing from ${this.label(p)}`);
    }
  }

  private async permission(): Promise<PermissionState | 'unknown'> {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      return status?.state || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /** Browser location → city name (null if refused, unavailable or not found) */
  private async fromDevice(): Promise<Place | null> {
    if (!this.canUseDevice) return null;
    this.locating.set(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 30 * 60 * 1000,
        })
      );
      return await this.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    } catch (err) {
      if ((err as GeolocationPositionError)?.code === 1) {
        // PERMISSION_DENIED — remember, so we don't prompt on every visit
        this.denied.set(true);
        this.write(DENIED_KEY, true);
      }
      return null;
    } finally {
      this.locating.set(false);
    }
  }

  /** Coordinates → city, via free keyless services */
  private async reverseGeocode(lat: number, lon: number): Promise<Place | null> {
    const la = lat.toFixed(4);
    const lo = lon.toFixed(4);
    const providers: [string, (r: any) => Place | null][] = [
      [
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`,
        (r) =>
          r?.countryName
            ? { city: r.city || r.locality || '', region: r.principalSubdivision || '', country: r.countryName, countryCode: r.countryCode || '' }
            : null,
      ],
      [
        `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=en&lat=${la}&lon=${lo}`,
        (r) => {
          const a = r?.address;
          if (!a?.country) return null;
          return {
            city: a.city || a.town || a.village || a.county || a.state_district || '',
            region: a.state || a.state_district || '',
            country: a.country,
            countryCode: (a.country_code || '').toUpperCase(),
          };
        },
      ],
    ];
    const p = await this.firstOf(providers);
    return p ? { ...p, source: 'gps', lat: this.round(lat), lon: this.round(lon) } : null;
  }

  private async fromIp(): Promise<Place | null> {
    const p = await this.firstOf([
      ['https://get.geojs.io/v1/ip/geo.json', (r) => r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '', ...this.coords(r.latitude, r.longitude) } : null],
      ['https://ipwho.is/', (r) => r?.success !== false && r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '', ...this.coords(r.latitude, r.longitude) } : null],
      ['https://ipapi.co/json/', (r) => r?.country_name ? { city: r.city || '', region: r.region || '', country: r.country_name, countryCode: r.country_code || '', ...this.coords(r.latitude, r.longitude) } : null],
    ]);
    return p ? { ...p, source: 'ip' } : null;
  }

  private async firstOf(providers: [string, (r: any) => Place | null][]): Promise<Place | null> {
    for (const [url, map] of providers) {
      try {
        const res = await firstValueFrom(this.http.get(url).pipe(timeout(6000)));
        const p = map(res);
        if (p) return this.tidy(p);
      } catch {
        /* try the next provider */
      }
    }
    return null;
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Provider latitude/longitude (numbers or strings) → rounded, or nothing */
  private coords(lat: unknown, lon: unknown): { lat?: number; lon?: number } {
    const a = Number(lat);
    const b = Number(lon);
    return lat != null && lon != null && isFinite(a) && isFinite(b) && (a || b) ? { lat: this.round(a), lon: this.round(b) } : {};
  }

  private save(p: Place): void {
    this.place.set(p);
    this.write(CACHE_KEY, { ...p, at: Date.now() });
  }

  /** Nicer names for places the providers spell awkwardly */
  private tidy(p: Place): Place {
    const region = /ladakh/i.test(p.region) ? 'Ladakh' : p.region.replace(/^National Capital Territory of /i, '');
    return { ...p, region, city: p.city.replace(/\s+(District|Tehsil|Sub-?division)$/i, '') };
  }

  private cached(): Place | null {
    const c = this.read<Place & { at: number }>(CACHE_KEY);
    return c && Date.now() - c.at < TTL ? c : null;
  }

  private read<T>(key: string): T | null {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
