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
});
