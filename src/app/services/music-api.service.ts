// ============================================
// vibeOnly — Music API Service
// ============================================

import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of, timeout } from 'rxjs';
import { map, catchError, shareReplay, defaultIfEmpty } from 'rxjs/operators';
import { Track } from '../models';
import { LocalProvider } from '../core/providers/local.provider';
import { RadioProvider } from '../core/providers/radio.provider';
import { SupabaseProvider } from '../core/providers/supabase.provider';
import { ArchiveProvider } from '../core/providers/archive.provider';
import { MusicProvider } from '../core/providers/music-provider.interface';

@Injectable({ providedIn: 'root' })
export class MusicApiService {
  private local = inject(LocalProvider);
  private radio = inject(RadioProvider);
  private supabase = inject(SupabaseProvider);
  private archive = inject(ArchiveProvider);

  // Active providers to aggregate from (Order determines priority in search results)
  private providers: MusicProvider[] = [this.supabase, this.local, this.radio, this.archive];

  private trendingCache$: Observable<Track[]> | null = null;

  getTrendingTracks(limit = 10): Observable<Track[]> {
    if (!this.trendingCache$) {
      this.trendingCache$ = this.aggregate(p => p.getTrendingTracks(limit)).pipe(shareReplay(1));
    }
    return this.trendingCache$;
  }

  getTracksByTag(tag: string, limit = 10): Observable<Track[]> {
    return this.aggregate(p => p.getTracksByTag(tag, limit));
  }

  searchTracks(query: string, limit = 20): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.aggregate(p => p.searchTracks(query, limit));
  }

  getFeaturedTracks(limit = 10): Observable<Track[]> {
    return this.aggregate(p => p.getFeaturedTracks(limit));
  }

  getRelaxTracks(limit = 10): Observable<Track[]> {
    return this.aggregate(p => p.getTracksByTag('relaxation', limit));
  }

  /**
   * Helper to execute a query across all active providers and merge the results.
   */
  private aggregate(queryFn: (provider: MusicProvider) => Observable<Track[]>): Observable<Track[]> {
    const queries = this.providers.map(p => 
      queryFn(p).pipe(
        timeout(12000), // Prevent hanging if a provider is slow (increased for Archive)
        catchError(err => {
          console.error(`[MusicApiService] Provider ${p.name} failed or timed out:`, err);
          return of([] as Track[]);
        })
      )
    );

    return forkJoin(queries).pipe(
      map(resultsArray => {
        // Flatten array of arrays
        const flattened = resultsArray.reduce((acc, curr) => acc.concat(curr), []);
        // Optional: Deduplicate by ID
        const unique = Array.from(new Map(flattened.map(item => [item.id, item])).values());
        return unique;
      }),
      defaultIfEmpty([])
    );
  }

  clearCache(): void {
    this.trendingCache$ = null;
  }
}

