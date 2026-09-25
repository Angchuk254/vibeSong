import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LocationService } from './location.service';

const IP_URL = 'https://get.geojs.io/v1/ip/geo.json';
const LEH = { latitude: 34.1526, longitude: 77.5771 };

describe('LocationService', () => {
  let loc: LocationService;
  let http: HttpTestingController;

  /** Wait until a request to `url` shows up (the service awaits between steps) */
  const next = async (url: string) => {
    for (let i = 0; i < 50; i++) {
      const found = http.match((r) => r.url.startsWith(url));
      if (found.length) return found[0];
      await new Promise((r) => setTimeout(r, 0));
    }
    throw new Error('No request to ' + url);
  };
  const fresh = () => TestBed.runInInjectionContext(() => new LocationService());

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    loc = TestBed.inject(LocationService);
    http = TestBed.inject(HttpTestingController);
  });

  describe('without device location', () => {
    it('shows Leh straight away, then the IP city', async () => {
      expect(loc.label()).toBe('Leh, Ladakh');
      const done = loc.refresh();
      (await next(IP_URL)).flush({ city: 'Pokhara', region: 'Gandaki', country: 'Nepal', country_code: 'NP' });
      await done;
      expect(loc.label()).toBe('Pokhara, Nepal');
      expect(loc.place()?.source).toBe('ip');
    });

    it('falls back to the next IP provider when one fails', async () => {
      const done = loc.refresh();
      (await next(IP_URL)).error(new ProgressEvent('offline'));
      (await next('https://ipwho.is/')).flush({ success: true, city: 'Thimphu', region: 'Thimphu', country: 'Bhutan', country_code: 'BT' });
      await done;
      expect(loc.label()).toBe('Thimphu, Bhutan');
    });

    it('defaults to Leh when nothing works', async () => {
      const done = loc.refresh();
      (await next(IP_URL)).error(new ProgressEvent('offline'));
      (await next('https://ipwho.is/')).error(new ProgressEvent('offline'));
      (await next('https://ipapi.co/')).error(new ProgressEvent('offline'));
      await done;
      expect(loc.label()).toBe('Leh, Ladakh');
      expect(loc.place()?.source).toBe('default');
    });

    it('shows the saved city instantly but checks again after a refresh', async () => {
      localStorage.setItem('vo_location', JSON.stringify({ city: 'Kathmandu', region: 'Bagmati', country: 'Nepal', countryCode: 'NP', source: 'ip', at: Date.now() }));
      const reloaded = fresh();
      expect(reloaded.label()).toBe('Kathmandu, Nepal');
      const done = reloaded.refresh();
      (await next(IP_URL)).flush({ city: 'Pokhara', region: 'Gandaki', country: 'Nepal', country_code: 'NP' });
      await done;
      expect(reloaded.label()).toBe('Pokhara, Nepal');
      await reloaded.refresh(); // same session, still fresh: no new lookup
      http.expectNone(IP_URL);
    });

    it('forgets the place when switched off', async () => {
      const done = loc.refresh();
      (await next(IP_URL)).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await done;
      loc.setEnabled(false);
      expect(loc.place()).toBeNull();
      expect(localStorage.getItem('vo_location')).toBeNull();
    });
  });

  describe('with device location', () => {
    let geo: { getCurrentPosition: ReturnType<typeof vi.fn> };
    const setPermission = (state: PermissionState) =>
      Object.defineProperty(navigator, 'permissions', { value: { query: async () => ({ state }) }, configurable: true });

    beforeEach(() => {
      vi.stubGlobal('isSecureContext', true);
      geo = { getCurrentPosition: vi.fn() };
      Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      delete (navigator as any).geolocation;
      delete (navigator as any).permissions;
    });

    it('asks automatically and uses GPS without an IP lookup', async () => {
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: LEH } as GeolocationPosition));
      const done = loc.refresh();
      const reverse = await next('https://api.bigdatacloud.net');
      expect(reverse.request.url).toContain('latitude=34.1526');
      reverse.flush({ city: 'Leh', principalSubdivision: 'Ladakh', countryName: 'India', countryCode: 'IN' });
      await done;
      http.expectNone(IP_URL);
      expect(loc.label()).toBe('Leh, Ladakh');
      expect(loc.place()?.source).toBe('gps');
    });

    it('uses the IP when location is blocked, and stops asking', async () => {
      geo.getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 1, message: 'denied' } as GeolocationPositionError)
      );
      const done = loc.refresh();
      (await next(IP_URL)).flush({ city: 'Dehradun', region: 'Uttarakhand', country: 'India', country_code: 'IN' });
      await done;
      expect(loc.place()?.source).toBe('ip');
      expect(loc.denied()).toBe(true);

      geo.getCurrentPosition.mockClear();
      const again = fresh();
      const done2 = again.refresh();
      (await next(IP_URL)).flush({ city: 'Dehradun', region: 'Uttarakhand', country: 'India', country_code: 'IN' });
      await done2;
      expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('switches to GPS by itself once location is allowed later', async () => {
      localStorage.setItem('vo_geo_denied', 'true');
      setPermission('granted');
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: LEH } as GeolocationPosition));
      const again = fresh();
      const done = again.refresh();
      (await next('https://api.bigdatacloud.net')).flush({ city: 'Leh', principalSubdivision: 'Ladakh', countryName: 'India', countryCode: 'IN' });
      await done;
      expect(again.place()?.source).toBe('gps');
      expect(again.denied()).toBe(false);
    });

    it('asks again on each app start while unanswered, but not in hourly checks', async () => {
      // Prompt dismissed / timed out (not blocked)
      geo.getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 3, message: 'timeout' } as GeolocationPositionError)
      );
      const done = loc.refresh();
      (await next(IP_URL)).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await done;
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);

      // Same session, an hour later: IP only, no prompt
      localStorage.setItem('vo_location', JSON.stringify({ ...loc.place(), at: Date.now() - 2 * 3600 * 1000 }));
      const hourly = loc.refresh();
      (await next(IP_URL)).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await hourly;
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);

      // Next app start: asks again
      const again = fresh();
      const done2 = again.refresh();
      (await next(IP_URL)).flush({ city: 'Leh', region: 'Ladakh', country: 'India', country_code: 'IN' });
      await done2;
      expect(geo.getCurrentPosition).toHaveBeenCalledTimes(2);
    });

    it('re-checks with GPS silently every hour when allowed, and announces a move', async () => {
      setPermission('granted');
      localStorage.setItem('vo_location', JSON.stringify({ city: 'Leh', region: 'Ladakh', country: 'India', countryCode: 'IN', source: 'gps', at: Date.now() - 61 * 60 * 1000 }));
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: { latitude: 34.55, longitude: 76.13 } } as GeolocationPosition));
      const notices: string[] = [];
      const listen = (e: Event) => notices.push((e as CustomEvent).detail);
      window.addEventListener('vo-notice', listen);

      const reloaded = fresh();
      const done = reloaded.refresh();
      expect(reloaded.label()).toBe('Leh, Ladakh'); // last city stays meanwhile
      (await next('https://api.bigdatacloud.net')).flush({ city: 'Kargil', principalSubdivision: 'Ladakh', countryName: 'India', countryCode: 'IN' });
      await done;
      http.expectNone(IP_URL);
      expect(reloaded.label()).toBe('Kargil, Ladakh');
      expect(notices.some((n) => n.includes('Kargil'))).toBe(true);
      window.removeEventListener('vo-notice', listen);
    });

    it('falls back to OpenStreetMap when the first reverse lookup fails', async () => {
      setPermission('granted');
      geo.getCurrentPosition.mockImplementation((ok: PositionCallback) => ok({ coords: LEH } as GeolocationPosition));
      const done = loc.refresh();
      (await next('https://api.bigdatacloud.net')).error(new ProgressEvent('down'));
      (await next('https://nominatim.openstreetmap.org')).flush({ address: { town: 'Leh', state: 'Ladakh', country: 'India', country_code: 'in' } });
      await done;
      expect(loc.label()).toBe('Leh, Ladakh');
      expect(loc.place()?.source).toBe('gps');
    });
  });
});
