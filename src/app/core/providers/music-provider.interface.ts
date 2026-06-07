import { Observable } from 'rxjs';
import { Track } from '../../models';

export interface MusicProvider {
  id: string;
  name: string;

  /** Get trending or popular tracks */
  getTrendingTracks(limit?: number, offset?: number): Observable<Track[]>;

  /** Get tracks matching a specific genre/tag */
  getTracksByTag(tag: string, limit?: number, offset?: number): Observable<Track[]>;

  /** Search tracks by query */
  searchTracks(query: string, limit?: number): Observable<Track[]>;
  
  /** Get featured or curated tracks */
  getFeaturedTracks(limit?: number): Observable<Track[]>;
}
