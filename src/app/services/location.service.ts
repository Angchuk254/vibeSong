// ============================================
// vibeOnly — Approximate location (for the Home greeting)
// ============================================
// Looks up the city from the user's IP address with free, keyless services.
// It's approximate (often the internet provider's city), cached for 12 hours,
// can be switched off in Settings, and only the city name is kept on-device.

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

export interface Place {
  city: string;
  region: string;
  country: string;
  countryCode: string;
}

const CACHE_KEY = 'vo_location';
const ENABLED_KEY = 'vo_show_location';
const TTL = 12 * 3600 * 1000;

@Injectable({ providedIn: 'root' })
export class LocationService {
  private http = inject(HttpClient);

  readonly enabled = signal(this.read<boolean>(ENABLED_KEY) !== false);
  readonly place = signal<Place | null>(this.cached());
  private loading: Promise<void> | null = null;

  setEnabled(on: boolean): void {
    this.enabled.set(on);
    this.write(ENABLED_KEY, on);
    if (!on) {
      this.place.set(null);
      try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
    } else {
      this.refresh();
    }
  }

  /** Fetch the city if we don't have a fresh one */
  refresh(): Promise<void> {
    if (!this.enabled()) return Promise.resolve();
    if (this.cached()) {
      this.place.set(this.cached());
      return Promise.resolve();
    }
    if (!this.loading) {
      this.loading = this.lookup()
        .then((p) => {
          if (p && this.enabled()) {
            this.place.set(p);
            this.write(CACHE_KEY, { ...p, at: Date.now() });
          }
        })
        .finally(() => (this.loading = null));
    }
    return this.loading;
  }

  /** "Leh, Ladakh" / "Kathmandu, Nepal" */
  label(p: Place | null = this.place()): string {
    if (!p?.city) return p?.country || '';
    const second = p.countryCode === 'IN' ? p.region : p.country;
    return second && second !== p.city ? `${p.city}, ${second}` : p.city;
  }

  private async lookup(): Promise<Place | null> {
    const providers: [string, (r: any) => Place | null][] = [
      ['https://get.geojs.io/v1/ip/geo.json', (r) => r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '' } : null],
      ['https://ipwho.is/', (r) => r?.success !== false && r?.country ? { city: r.city || '', region: r.region || '', country: r.country, countryCode: r.country_code || '' } : null],
      ['https://ipapi.co/json/', (r) => r?.country_name ? { city: r.city || '', region: r.region || '', country: r.country_name, countryCode: r.country_code || '' } : null],
    ];
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

  /** Nicer names for places the providers spell awkwardly */
  private tidy(p: Place): Place {
    const region = /ladakh/i.test(p.region) ? 'Ladakh' : p.region.replace(/^National Capital Territory of /i, '');
    return { ...p, region, city: p.city.replace(/\s+District$/i, '') };
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
}
