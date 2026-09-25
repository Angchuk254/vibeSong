import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin, from } from 'rxjs';
import { map, catchError, switchMap, mergeMap, toArray, timeout } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';

@Injectable({ providedIn: 'root' })
export class ArchiveProvider implements MusicProvider {
  id = 'archive';
  name = 'Internet Archive';

  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://archive.org/advancedsearch.php';
  private readonly metadataUrl = 'https://archive.org/metadata';

  getTrendingTracks(limit = 10): Observable<Track[]> {
    return this.searchArchive('meditation music OR tibetan bowls', limit);
  }

  getTracksByTag(tag: string, limit = 10): Observable<Track[]> {
    return this.searchArchive(tag, limit);
  }

  searchTracks(query: string, limit = 10): Observable<Track[]> {
    if (!query.trim()) return of([]);
    return this.searchArchive(query, limit);
  }

  getFeaturedTracks(limit = 10): Observable<Track[]> {
    return this.searchArchive('himalayan music OR tibetan OR nepali folk OR indian classical', limit);
  }

  private searchArchive(query: string, limit: number): Observable<Track[]> {
    // Expand query for better Himalayan coverage
    let expandedQuery = query;
    const qLower = query.toLowerCase();
    // Single-word regional searches get widened; explicit OR queries are left alone
    if (qLower === 'ladakhi') expandedQuery = 'ladakhi OR ladakh OR zanskar OR "leh ladakh"';
    else if (qLower === 'spiti') expandedQuery = 'spiti OR kinnauri OR kinnaur OR lahaul OR lahauli';
    else if (qLower === 'pahadi') expandedQuery = 'pahadi OR "himachal folk" OR "kumaoni" OR "garhwali"';
    
    const iaQuery = `(${expandedQuery}) AND mediatype:audio`;
    // Sort by downloads desc to get the most popular first
    const url = `${this.baseUrl}?q=${encodeURIComponent(iaQuery)}&fl[]=identifier,title,creator,date,description,downloads&rows=${limit * 2}&page=1&sort[]=downloads+desc&output=json`;

    return this.http.get<any>(url).pipe(
      timeout(10000), // Initial search timeout
      switchMap((res) => {
        if (!res?.response?.docs || res.response.docs.length === 0) return of([]);
        
        // Fetch metadata with concurrency control to avoid timeouts
        const docs = res.response.docs.slice(0, limit);
        return from(docs).pipe(
          mergeMap((doc: any) => 
            this.http.get<any>(`${this.metadataUrl}/${doc.identifier}`).pipe(
              timeout(4000), // Individual metadata timeout
              map(meta => this.mapToTrack(doc, meta)),
              catchError(() => of(null))
            ),
            3 // Limit concurrency to 3 parallel requests
          ),
          toArray(),
          map(tracks => tracks.filter(t => t !== null) as Track[])
        );
      }),
      catchError((err) => {
        console.error('[ArchiveProvider] Error:', err);
        return of([]);
      })
    );
  }

  private mapToTrack(doc: any, meta: any): Track | null {
    if (!meta || !meta.files) return null;
    
    // Find a valid MP3 file
    const mp3File = meta.files.find((f: any) => f.name.endsWith('.mp3'));
    if (!mp3File) return null;

    const audioUrl = `https://archive.org/download/${doc.identifier}/${encodeURIComponent(mp3File.name)}`;

    return {
      id: doc.identifier,
      name: doc.title || 'Unknown Title',
      artist_name: doc.creator || 'Archive Collection',
      artist_id: doc.identifier,
      album_name: 'Internet Archive',
      album_id: doc.identifier,
      album_image: `https://archive.org/services/img/${doc.identifier}`,
      duration: parseFloat(mp3File.length || '0'),
      audio: audioUrl,
      audiodownload: audioUrl,
      image: `https://archive.org/services/img/${doc.identifier}`,
      releasedate: doc.date || '',
      position: 1,
      provider: this.id
    };
  }
}

