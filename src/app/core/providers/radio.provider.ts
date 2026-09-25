import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, timeout } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';

@Injectable({ providedIn: 'root' })
export class RadioProvider implements MusicProvider {
  id = 'radio';
  name = 'Radio Browser';

  private readonly http = inject(HttpClient);
  // Mirrors are tried in order if one is down
  private readonly mirrors = [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
  ];

  getTrendingTracks(limit = 10): Observable<Track[]> {
    // Use clicktimestamp for more dynamic "trending" results
    return this.fetchStations({ tag: 'bollywood', limit: limit.toString(), order: 'clicktimestamp' });
  }

  getTracksByTag(tag: string, limit = 10): Observable<Track[]> {
    const regionalTags = [
      'ladakhi', 'spiti', 'pahadi', 'uttarakhand', 'himachali', 'bollywood', 'punjabi', 'hindi', 'nepal', 'india', 'tibet', 'pakistan',
      'lofi', 'jazz', 'zen', 'chillout', '80s', 'rock', 'classical', 'electronic'
    ];
    if (regionalTags.includes(tag.toLowerCase())) {
      return this.getRegionalTracks(tag, limit);
    }
    return this.fetchStations({ tag, limit: limit.toString() });
  }

  searchTracks(query: string, limit = 15): Observable<Track[]> {
    if (!query.trim()) return of([]);
    // Try searching by name first
    return this.fetchStations({ name: query, limit: limit.toString() }).pipe(
      switchMap((nameResults: Track[]) => {
        if (nameResults.length >= limit) return of(nameResults);
        // If not enough name results, try searching by tag and merge
        return this.fetchStations({ tag: query, limit: Math.max(0, limit - nameResults.length).toString() }).pipe(
          map((tagResults: Track[]) => {
            const existingIds = new Set(nameResults.map((r: Track) => r.id));
            const uniqueTagResults = tagResults.filter((r: Track) => !existingIds.has(r.id));
            return [...nameResults, ...uniqueTagResults];
          })
        );
      })
    );
  }

  getFeaturedTracks(limit = 12): Observable<Track[]> {
    return this.fetchStations({ tag: 'folk', limit: limit.toString() });
  }

  getRegionalTracks(region: string, limit = 10): Observable<Track[]> {
    // Each entry is a separate search; results are merged. Radio Browser's
    // `tag` matches a single tag, so "a,b,c" has to be split into queries.
    const q = (p: Record<string, string>) => p;
    const tags = (...t: string[]) => t.map((tag) => q({ tag }));
    const plans: Record<string, Record<string, string>[]> = {
      pakistan: [q({ countrycode: 'PK' })],
      india: [q({ countrycode: 'IN' })],
      nepal: [q({ countrycode: 'NP' })],
      tibet: [...tags('tibetan', 'buddhist', 'mantra'), q({ name: 'tibet' })],
      uttarakhand: [...tags('uttarakhand', 'garhwali', 'pahadi'), q({ name: 'uttarakhand' })],
      himachali: [...tags('himachal', 'pahadi'), q({ name: 'himachal' }), q({ name: 'shimla' })],
      ladakhi: [q({ name: 'leh' }), q({ name: 'ladakh' }), q({ name: 'kargil' }), ...tags('ladakh', 'ladakhi')],
      spiti: [q({ name: 'spiti' }), q({ name: 'kinnaur' }), q({ name: 'lahaul' }), ...tags('himachal')],
      pahadi: tags('pahadi', 'dogri', 'himachal', 'uttarakhand'),
      bollywood: [...tags('bollywood', 'hindi'), q({ name: 'mirchi' })],
      punjabi: [q({ language: 'punjabi' }), ...tags('punjabi', 'bhangra')],
      hindi: [q({ language: 'hindi' }), ...tags('bollywood', 'hindi')],
      lofi: tags('lofi', 'chill', 'study'),
      jazz: tags('jazz', 'smooth jazz'),
      zen: tags('meditation', 'zen', 'ambient'),
      '80s': tags('80s', 'retro'),
      rock: tags('rock', 'classic rock'),
      electronic: tags('electronic', 'house', 'techno'),
      classical: tags('classical', 'opera'),
    };

    let plan = plans[region.toLowerCase()];
    if (!plan) {
      // "country:NP" → that country, "tag:news" → by tag, "name:leh" → by station name
      if (region.startsWith('country:')) plan = [q({ countrycode: region.slice(8).toUpperCase() })];
      else if (region.startsWith('tag:')) plan = [q({ tag: region.slice(4) })];
      else if (region.startsWith('name:')) plan = [q({ name: region.slice(5) })];
      else plan = [q({ tag: region })];
    }

    const per = String(Math.max(5, Math.ceil(limit / plan.length) + 3));
    return forkJoin(plan.map((p) => this.fetchStations({ ...p, limit: per }))).pipe(
      map((lists) => {
        const seen = new Set<string>();
        return lists.flat().filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, limit);
      })
    );
  }

  private fetchStations(params: any): Observable<Track[]> {
    const requested = parseInt(params.limit, 10) || 20;
    const queryParams = new URLSearchParams({
      ...params,
      // Over-fetch: many stations get dropped by the playability filter below
      limit: String(requested * 3),
      format: 'json',
      hidebroken: 'true',
      order: params.order || 'clickcount',
      reverse: 'true'
    });

    const tryMirror = (i: number): Observable<any[]> =>
      this.http.get<any[]>(`${this.mirrors[i]}/json/stations/search?${queryParams.toString()}`).pipe(
        timeout(8000),
        catchError(() => (i + 1 < this.mirrors.length ? tryMirror(i + 1) : of([] as any[])))
      );

    return tryMirror(0).pipe(
      map(res => {
        if (!Array.isArray(res)) return [];
        return res
          .filter(station => this.isPlayable(station))
          .slice(0, requested)
          .map(station => this.mapToTrack(station));
      }),
      catchError(err => {
        console.error('[RadioProvider] Error:', err);
        return of([]);
      })
    );
  }

  /**
   * HLS needs hls.js, and plain-HTTP streams are blocked as mixed content on an
   * HTTPS site — those two cases were the bulk of the "not working" stations.
   */
  private isPlayable(station: any): boolean {
    const url: string = station.url_resolved || '';
    return (
      station.hls === 0 &&
      station.lastcheckok === 1 &&
      url.startsWith('https://') &&
      !/\.m3u8?($|\?)|\.pls($|\?)/i.test(url)
    );
  }

  private mapToTrack(station: any): Track {
    const fallbackImage = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80';
    
    const streamUrl = station.url_resolved;

    return {
      id: `radio-${station.stationuuid}`,
      name: station.name ? station.name.trim() : 'Unknown Station',
      artist_name: station.country || 'Live Radio',
      artist_id: `country-${station.countrycode}`,
      album_name: 'Radio Browser',
      album_id: 'radio-live',
      album_image: station.favicon || fallbackImage,
      duration: 0, // Live streams have 0 duration
      audio: streamUrl,
      audiodownload: streamUrl,
      image: station.favicon || fallbackImage,
      releasedate: '',
      position: 1,
      tags: station.tags || '',
      provider: this.id,
      isLive: true
    };
  }
}
