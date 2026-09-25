import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LocationService } from './location.service';

describe('LocationService', () => {
  let loc: LocationService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    loc = TestBed.inject(LocationService);
    http = TestBed.inject(HttpTestingController);
  });

  const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };

  it('finds the city and labels Indian places with their region', async () => {
    const done = loc.refresh();
    http.expectOne('https://get.geojs.io/v1/ip/geo.json').flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
    await done;
    expect(loc.label()).toBe('Leh, Ladakh');
  });

  it('falls back to the next provider when one fails', async () => {
    const done = loc.refresh();
    http.expectOne('https://get.geojs.io/v1/ip/geo.json').error(new ProgressEvent('offline'));
    await flush();
    http.expectOne('https://ipwho.is/').flush({ success: true, city: 'Thimphu', region: 'Thimphu', country: 'Bhutan', country_code: 'BT' });
    await done;
    expect(loc.label()).toBe('Thimphu, Bhutan');
  });

  it('uses the cache instead of asking again', async () => {
    localStorage.setItem('vo_location', JSON.stringify({ city: 'Kathmandu', region: 'Bagmati', country: 'Nepal', countryCode: 'NP', at: Date.now() }));
    const fresh = TestBed.runInInjectionContext(() => new LocationService());
    await fresh.refresh();
    http.expectNone('https://get.geojs.io/v1/ip/geo.json');
    expect(fresh.label()).toBe('Kathmandu, Nepal');
  });

  it('forgets the place when switched off', async () => {
    const done = loc.refresh();
    http.expectOne('https://get.geojs.io/v1/ip/geo.json').flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
    await done;
    loc.setEnabled(false);
    expect(loc.place()).toBeNull();
    expect(localStorage.getItem('vo_location')).toBeNull();
  });

  describe('device location', () => {
    const LEH = { latitude: 34.1526, longitude: 77.5771 };
    let geo: { getCurrentPosition: ReturnType<typeof vi.fn> };

    /** Wait until a request to `url` shows up (the service awaits between steps) */
    const next = async (url: string) => {
      for (let i = 0; i < 50; i++) {
        const found = http.match((r) => r.url.startsWith(url));
        if (found.length) return found[0];
        await new Promise((r) => setTimeout(r, 0));
      }
      throw new Error('No request to ' + url);
    };

    beforeEach(() => {
      vi.stubGlobal('isSecureContext', true);
      geo = { getCurrentPosition: vi.fn() };
      Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete (navigator as any).geolocation;
    });

    it('shows the IP city first, then upgrades to the device location', async () => {
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: LEH } as GeolocationPosition));
      const done = loc.refresh();
      (await next('https://get.geojs.io')).flush({ city: 'Srinagar', region: 'Jammu and Kashmir', country: 'India', country_code: 'IN' });
      const reverse = await next('https://api.bigdatacloud.net');
      expect(loc.label()).toBe('Srinagar, Jammu and Kashmir'); // IP city shown meanwhile
      expect(reverse.request.url).toContain('latitude=34.1526');
      reverse.flush({ city: 'Leh', locality: 'Leh', principalSubdivision: 'Ladakh', countryName: 'India', countryCode: 'IN' });
      await done;
      expect(loc.label()).toBe('Leh, Ladakh');
      expect(loc.place()?.source).toBe('gps');
    });

    it('keeps the IP city and stops asking when location is blocked', async () => {
      geo.getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 1, message: 'denied' } as GeolocationPositionError)
      );
      const done = loc.refresh();
      (await next('https://get.geojs.io')).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await done;
      expect(loc.label()).toBe('Leh, Ladakh');
      expect(loc.place()?.source).toBe('ip');
      expect(loc.denied()).toBe(true);

      // Next visit: no prompt again
      geo.getCurrentPosition.mockClear();
      localStorage.removeItem('vo_location');
      const again = TestBed.runInInjectionContext(() => new LocationService());
      const done2 = again.refresh();
      (await next('https://get.geojs.io')).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await done2;
      expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('falls back to OpenStreetMap when the first reverse lookup fails', async () => {
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: LEH } as GeolocationPosition));
      const ok = loc.usePreciseLocation();
      (await next('https://api.bigdatacloud.net')).error(new ProgressEvent('down'));
      (await next('https://nominatim.openstreetmap.org')).flush({ address: { town: 'Leh', state: 'Ladakh', country: 'India', country_code: 'in' } });
      expect(await ok).toBe(true);
      expect(loc.label()).toBe('Leh, Ladakh');
    });

    it('checks again after an hour and uses GPS silently when allowed', async () => {
      const hourAgo = Date.now() - 61 * 60 * 1000;
      localStorage.setItem('vo_location', JSON.stringify({ city: 'Leh', region: 'Ladakh', country: 'India', countryCode: 'IN', source: 'gps', at: hourAgo }));
      Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state: 'granted' }) }, configurable: true });
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: { latitude: 34.55, longitude: 76.13 } } as GeolocationPosition));
      const notices: string[] = [];
      const listen = (e: Event) => notices.push((e as CustomEvent).detail);
      window.addEventListener('vo-notice', listen);

      const fresh = TestBed.runInInjectionContext(() => new LocationService());
      expect(fresh.label()).toBe(''); // stale, not trusted
      const done = fresh.refresh();
      expect(fresh.label()).toBe('Leh, Ladakh'); // last city stays on screen meanwhile
      (await next('https://api.bigdatacloud.net')).flush({ city: 'Kargil', principalSubdivision: 'Ladakh', countryName: 'India', countryCode: 'IN' });
      await done;

      http.expectNone('https://get.geojs.io/v1/ip/geo.json'); // no IP step, no prompt
      expect(fresh.label()).toBe('Kargil, Ladakh');
      expect(notices.some((n) => n.includes('Kargil'))).toBe(true);
      window.removeEventListener('vo-notice', listen);
      delete (navigator as any).permissions;
    });

    it('asks for permission automatically only once', async () => {
      geo.getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 3, message: 'timeout' } as GeolocationPositionError) // dismissed / timed out, not blocked
      );
      const first = loc.refresh();
      (await next('https://get.geojs.io')).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await first;
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);

      localStorage.setItem('vo_location', JSON.stringify({ ...loc.place(), at: Date.now() - 2 * 3600 * 1000 }));
      const again = TestBed.runInInjectionContext(() => new LocationService());
      const second = again.refresh();
      (await next('https://get.geojs.io')).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await second;
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1); // not prompted again
    });
  });
});
