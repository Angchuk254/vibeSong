// ============================================
// vibeOnly — Location (for the Home greeting)
// ============================================
// 1. Shows the city from the IP address straight away (no prompt, approximate).
// 2. Asks the browser for the device location once; if allowed, the GPS
//    position is turned into a city name and replaces the IP guess.
// 3. If the user blocks it or the device can't tell, the IP city stays and we
//    don't ask again automatically (a tap on 🎯 can retry).
// 4. Re-checked on every app start / refresh and every hour after that (and
//    when the app comes back to the foreground), because people move — with
//    location allowed this uses GPS silently. The last city shows meanwhile.
// Only the city name is kept on-device; can be turned off.

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { notify } from './storage.service';

export interface Place {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  /** 'gps' = from the device location, 'ip' = from the internet connection */
  source?: 'gps' | 'ip';
}

const CACHE_KEY = 'vo_location';
const ENABLED_KEY = 'vo_show_location';
const DENIED_KEY = 'vo_geo_denied';
const ASKED_KEY = 'vo_geo_asked';
/** How long a city is trusted before checking again */
export const LOCATION_TTL = 60 * 60 * 1000;
const TTL = LOCATION_TTL;

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);

  readonly enabled = signal(this.read<boolean>(ENABLED_KEY) !== false);
  readonly place = signal<Place | null>(this.cached());
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

  /** User tapped 🎯 — ask for the precise location again */
  async usePreciseLocation(): Promise<boolean> {
    this.remove(DENIED_KEY);
    this.denied.set(false);
    const p = await this.fromDevice();
    if (p) {
      this.save(p);
      notify(`📍 Got it — vibing from ${this.label(p)}`);
    } else if (this.denied()) {
      notify('Location is blocked for this site. Tap the 🔒 next to the address bar → Location → Allow, then try again.');
    } else {
      notify("Couldn't get your location right now — keeping the city from your internet connection.");
    }
    return !!p;
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
    this.checkedThisLoad = true;
    // Keep showing the last known city while we look again (no flicker)
    const previous = this.place() || this.read<Place>(CACHE_KEY);
    if (previous && !this.place()) this.place.set(previous);

    const permission = this.canUseDevice && !this.denied() ? await this.permission() : 'denied';

    // Location already allowed: go straight to GPS, silently
    if (permission === 'granted') {
      const gps = await this.fromDevice();
      if (gps) return this.update(gps, previous);
    }

    // Otherwise (or if GPS failed) use the IP address
    const ip = await this.fromIp();
    if (ip) this.update(ip, previous);

    // Ask for the device location automatically only once, ever — browsers
    // block sites that keep prompting. After that, 🎯 retries on demand.
    const askedBefore = this.read<boolean>(ASKED_KEY) === true;
    if (!askedBefore && (permission === 'prompt' || permission === 'unknown')) {
      this.write(ASKED_KEY, true);
      const gps = await this.fromDevice();
      if (gps) this.update(gps, this.place());
    }
  }

  /** Save the new place and say so if the city changed */
  private update(p: Place, previous: Place | null): void {
    if (!this.enabled()) return;
    this.save(p);
    if (previous?.city && p.city && previous.city.toLowerCase() !== p.city.toLowerCase()) {
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
    return p ? { ...p, source: 'gps' } : null;
  }

  private async fromIp(): Promise<Place | null> {
    const p = await this.firstOf([
      ['https://get.geojs.io/v1/ip/geo.json', (r) => r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '' } : null],
      ['https://ipwho.is/', (r) => r?.success !== false && r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '' } : null],
      ['https://ipapi.co/json/', (r) => r?.country_name ? { city: r.city || '', region: r.region || '', country: r.country_name, countryCode: r.country_code || '' } : null],
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
