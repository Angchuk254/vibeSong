import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';

@Injectable({ providedIn: 'root' })
export class RadioProvider implements MusicProvider {
  id = 'radio';
  name = 'Radio Browser';

  private readonly http = inject(HttpClient);
  // Using a stable node. In a full app, you would fetch from all.api.radio-browser.info/json/servers
  private readonly baseUrl = 'https://de1.api.radio-browser.info/json/stations';

  getTrendingTracks(limit = 10): Observable<Track[]> {
    // Use clicktimestamp for more dynamic "trending" results
    return this.fetchStations({ tag: 'bollywood', limit: limit.toString(), order: 'clicktimestamp' });
  }

  getTracksByTag(tag: string, limit = 10): Observable<Track[]> {
    const regionalTags = [
      'ladakhi', 'pahadi', 'uttarakhand', 'himachali', 'bollywood', 'punjabi', 'hindi', 'nepal', 'india', 'tibet', 'pakistan',
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
    const params: any = { limit: limit.toString(), order: 'clickcount' };
    
    // Use broader tags or name search for niche regions
    switch(region.toLowerCase()) {
      case 'pakistan': 
        params.country = 'Pakistan'; 
        break;
      case 'india': 
        params.countrycode = 'IN';
        break;
      case 'tibet': 
        params.tag = 'tibetan,buddhist,mantra';
        break;
      case 'nepal': 
        params.country = 'Nepal'; 
        break;
      case 'uttarakhand':
        params.tag = 'uttarakhand,pahadi,hindi';
        break;
      case 'himachali':
        params.tag = 'himachal,pahadi,hindi';
        break;
      case 'ladakhi':
        params.tag = 'ladakh,tibetan,buddhist';
        params.name = 'Ladakh'; // Specific name match often works better for Ladakh
        break;
      case 'pahadi':
        params.tag = 'pahadi,dogri,himachal,uttarakhand';
        break;
      case 'bollywood':
        params.tag = 'bollywood,romantic,hindi';
        params.name = 'mirchi'; 
        break;
      case 'punjabi':
        params.language = 'punjabi';
        params.tag = 'punjabi,desi,bhangra';
        break;
      case 'hindi':
        params.language = 'hindi';
        params.tag = 'bollywood,classic,oldies';
        break;
      case 'lofi':
        params.tag = 'lofi,chill,study,relax';
        break;
      case 'jazz':
        params.tag = 'jazz,smooth,blues';
        break;
      case 'zen':
        params.tag = 'meditation,zen,yoga,ambient';
        break;
      case '80s':
        params.tag = '80s,retro,classic rock';
        break;
      case 'rock':
        params.tag = 'rock,hard rock,classic rock';
        break;
      case 'electronic':
        params.tag = 'electronic,house,techno,dance';
        break;
      case 'classical':
        params.tag = 'classical,opera,symphony';
        break;
      default: 
        params.tag = region;
    }

    // Set a higher default limit for regional discovery
    params.limit = (parseInt(params.limit) || 20).toString();

    return this.fetchStations(params);
  }

  private fetchStations(params: any): Observable<Track[]> {
    const queryParams = new URLSearchParams({
      ...params,
      format: 'json',
      hidebroken: 'true',
      order: params.order || 'clickcount',
      reverse: 'true'
    });
    
    return this.http.get<any[]>(`${this.baseUrl}/search?${queryParams.toString()}`).pipe(
      map(res => {
        if (!Array.isArray(res)) return [];
        return res
          // Filter out HLS streams because raw HTML5 audio doesn't support m3u8 in most browsers without hls.js
          .filter(station => station.hls === 0 && station.url_resolved)
          .map(station => this.mapToTrack(station));
      }),
      catchError(err => {
        console.error('[RadioProvider] Error:', err);
        return of([]);
      })
    );
  }

  private mapToTrack(station: any): Track {
    const fallbackImage = 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&q=80';
    
    // Some radio stations use HTTP. If the app is hosted on HTTPS, mixed content will block it.
    // For this prototype, we'll return the url directly.
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
      provider: this.id
    };
  }
}
