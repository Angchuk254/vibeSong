import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, timeout } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';
import { DataSaverService } from '../../services/data-saver.service';

@Injectable({ providedIn: 'root' })
export class RadioProvider implements MusicProvider {
  id = 'radio';
  name = 'Radio Browser';

  private readonly http = inject(HttpClient);
  private readonly saver = inject(DataSaverService);
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
      'ladakhi', 'spiti', 'bhutan', 'himalayan', 'pahadi', 'uttarakhand', 'himachali', 'bollywood', 'punjabi', 'hindi', 'nepal', 'india', 'tibet', 'pakistan',
      'lofi', 'jazz', 'zen', 'chillout', '80s', 'rock', 'classical', 'electronic', 'retro-hindi', 'sufi', 'hiphop', 'kpop'
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
      nepal: [q({ countrycode: 'NP' }), q({ name: 'nepal' }), q({ name: 'kantipur' }), ...tags('nepali', 'nepal')],
      bhutan: [q({ countrycode: 'BT' }), q({ name: 'bhutan' }), q({ name: 'kuzoo' }), q({ name: 'bbs' }), ...tags('bhutan', 'dzongkha')],
      himalayan: [
        q({ countrycode: 'NP' }), q({ countrycode: 'BT' }), q({ name: 'leh' }), q({ name: 'ladakh' }),
        ...tags('tibetan', 'himalayan'),
      ],
      tibet: [...tags('tibetan', 'buddhist', 'mantra'), q({ name: 'tibet' })],
      // Few stations are tagged this precisely, so each plan ends with a broader
      // Indian folk search to keep the page from coming up empty.
      uttarakhand: [
        ...tags('uttarakhand', 'garhwali', 'kumaoni', 'pahadi'),
        q({ name: 'uttarakhand' }), q({ name: 'garhwal' }), q({ name: 'dehradun' }), q({ name: 'kumaon' }),
        q({ countrycode: 'IN', tag: 'folk' }),
      ],
      himachali: [
        ...tags('himachal', 'himachali', 'pahadi'),
        q({ name: 'himachal' }), q({ name: 'shimla' }), q({ name: 'kullu' }), q({ name: 'dharamshala' }),
        q({ countrycode: 'IN', tag: 'folk' }),
      ],
      ladakhi: [
        q({ name: 'leh' }), q({ name: 'ladakh' }), q({ name: 'kargil' }), ...tags('ladakh', 'ladakhi'),
        q({ name: 'akashvani leh' }), ...tags('tibetan', 'himalayan'),
      ],
      spiti: [q({ name: 'spiti' }), q({ name: 'kinnaur' }), q({ name: 'lahaul' }), ...tags('himachal', 'himalayan')],
      pahadi: [
        ...tags('pahadi', 'pahari', 'garhwali', 'himachal', 'uttarakhand', 'dogri'),
        q({ name: 'pahadi' }), q({ name: 'himachal' }), q({ name: 'uttarakhand' }), q({ name: 'jammu' }),
        q({ countrycode: 'IN', tag: 'folk' }),
      ],
      'retro-hindi': [...tags('old hindi', 'retro bollywood', 'old bollywood', 'hindi classics'), q({ name: 'purani' }), q({ name: 'old hindi' }), q({ countrycode: 'IN', tag: 'oldies' })],
      sufi: tags('sufi', 'qawwali', 'ghazal', 'ghazals'),
      hiphop: tags('hip hop', 'hiphop', 'rap', 'rnb'),
      kpop: tags('kpop', 'k-pop', 'jpop', 'korean'),
      bollywood: [...tags('bollywood', 'hindi'), q({ name: 'mirchi' })],
      punjabi: [q({ language: 'punjabi' }), ...tags('punjabi', 'bhangra')],
      hindi: [q({ language: 'hindi' }), ...tags('bollywood', 'hindi')],
      lofi: tags('lofi', 'chill', 'study'),
      jazz: tags('jazz', 'smooth jazz'),
      zen: tags('chillout', 'ambient', 'meditation', 'zen', 'downtempo'),
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
        const playable = res.filter(station => this.isPlayable(station)).map(station => this.mapToTrack(station));
        // Data saver: lighter streams first, so they make the cut
        return this.saver.preferLight(playable).slice(0, requested);
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
      isLive: true,
      bitrate: Number(station.bitrate) || undefined,
    };
  }
}
