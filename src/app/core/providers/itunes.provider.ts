import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';
import { Track, ArtistSummary } from '../../models';
import { MusicProvider } from './music-provider.interface';

/**
 * iTunes Search — huge mainstream catalog (Bollywood, Punjabi, Nepali, global hits).
 * Only 30-second previews are streamable, so every track is flagged isPreview.
 */
@Injectable({ providedIn: 'root' })
export class ItunesProvider implements MusicProvider {
  id = 'itunes';
  name = 'iTunes Previews';

  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://itunes.apple.com/search';

  getTrendingTracks(limit = 20): Observable<Track[]> {
    return this.search('bollywood hits', limit);
  }

  getTracksByTag(tag: string, limit = 20): Observable<Track[]> {
    return this.search(tag, limit);
  }

  searchTracks(query: string, limit = 20): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.search(query, limit);
  }

  getFeaturedTracks(limit = 20): Observable<Track[]> {
    return this.search('arijit singh', limit);
  }

  search(term: string, limit = 20, country = 'IN'): Observable<Track[]> {
    const qs = new URLSearchParams({
      term,
      media: 'music',
      entity: 'song',
      limit: String(limit),
      country,
    });
    return this.http.get<{ results: any[] }>(`${this.baseUrl}?${qs.toString()}`).pipe(
      timeout(10000),
      map((res) =>
        (res?.results || [])
          .filter((r) => r.previewUrl && r.kind === 'song')
          .map((r) => this.mapToTrack(r))
      ),
      catchError((err) => {
        console.error('[ItunesProvider] Error:', err);
        return of([]);
      })
    );
  }

  /** Songs by an artist; the artist's own picture isn't in the API so we use their newest cover */
  getArtist(id: string, limit = 50): Observable<{ artist: ArtistSummary | null; tracks: Track[] }> {
    const qs = new URLSearchParams({ id, entity: 'song', limit: String(limit), country: 'IN' });
    return this.http.get<{ results: any[] }>(`https://itunes.apple.com/lookup?${qs.toString()}`).pipe(
      timeout(10000),
      map((res) => {
        const results = res?.results || [];
        const info = results.find((r) => r.wrapperType === 'artist');
        const tracks = results.filter((r) => r.kind === 'song' && r.previewUrl).map((r) => this.mapToTrack(r));
        const artist: ArtistSummary | null = info
          ? {
              ref: `itunes:${info.artistId}`,
              name: info.artistName,
              image: tracks[0]?.image || '',
              bio: info.primaryGenreName ? `${info.primaryGenreName} artist` : '',
              trackCount: tracks.length,
            }
          : null;
        return { artist, tracks };
      }),
      catchError(() => of({ artist: null, tracks: [] as Track[] }))
    );
  }

  private mapToTrack(r: any): Track {
    // Upgrade the 100px artwork to a sharper size
    const art = (r.artworkUrl100 || '').replace('100x100bb', '600x600bb');
    return {
      id: `itunes-${r.trackId}`,
      name: r.trackName,
      artist_name: r.artistName,
      artist_id: `itunes-${r.artistId}`,
      album_name: r.collectionName || '',
      album_id: `itunes-${r.collectionId}`,
      album_image: art,
      duration: 30,
      audio: r.previewUrl,
      audiodownload: r.previewUrl,
      image: art,
      releasedate: r.releaseDate || '',
      position: r.trackNumber || 1,
      genre: r.primaryGenreName,
      provider: this.id,
      isPreview: true,
      artistRef: r.artistId ? `itunes:${r.artistId}` : undefined,
    };
  }
}
