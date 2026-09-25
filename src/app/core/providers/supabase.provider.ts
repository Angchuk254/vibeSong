import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';
import { environment } from '../environment';

@Injectable({ providedIn: 'root' })
export class SupabaseProvider implements MusicProvider {
  id = 'supabase';
  name = 'Supabase Storage';

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.key
    );
  }

  getTrendingTracks(limit = 10): Observable<Track[]> {
    return this.fetchTracks('trending', limit);
  }

  getTracksByTag(tag: string, limit = 10): Observable<Track[]> {
    return this.fetchTracks(tag, limit);
  }

  searchTracks(query: string, limit = 10): Observable<Track[]> {
    if (!query.trim()) return of([]);
    
    // Characters that would break PostgREST's or() filter syntax
    query = query.replace(/[,()%*\\]/g, ' ').trim();
    if (!query) return of([]);

    // Simple text search on the 'tracks' table
    const promise = this.supabase
      .from('tracks')
      .select('*')
      .or(`title.ilike.%${query}%,artist.ilike.%${query}%,category.ilike.%${query}%,tags.ilike.%${query}%`)
      .limit(limit)
      .then(({ data, error }) => {
        if (error) throw error;
        return data.map(t => this.mapToTrack(t));
      });

    return from(promise).pipe(
      catchError(err => {
        console.error('[SupabaseProvider] Search error:', err);
        return of([]);
      })
    );
  }

  getFeaturedTracks(limit = 10): Observable<Track[]> {
    return this.fetchTracks('featured', limit);
  }

  private fetchTracks(category: string, limit: number): Observable<Track[]> {
    // We assume there is a 'tracks' table in your Supabase database.
    // If you only want to read directly from a storage bucket, we would use:
    // this.supabase.storage.from('music').list()
    
    let query = this.supabase
      .from('tracks')
      .select('*');
    
    // Only filter if it's a specific category (ignore 'featured' or 'trending' as they are generic)
    if (category !== 'featured' && category !== 'trending' && category !== 'all') {
      // Case-insensitive so 'ladakhi' matches uploads saved as 'Ladakhi'
      query = query.ilike('category', category);
    }

    const promise = query
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (error) throw error;
        return data.map(t => this.mapToTrack(t));
      });

    return from(promise).pipe(
      catchError(err => {
        console.error(`[SupabaseProvider] Error fetching ${category} tracks:`, err);
        return of([]);
      })
    );
  }

  private mapToTrack(row: any): Track {
    // Maps your Supabase 'tracks' table columns to the app's Track interface
    return {
      id: `supabase-${row.id}`,
      name: row.title || 'Unknown Title',
      artist_name: row.artist || 'Unknown Artist',
      artist_id: `artist-${row.artist}`,
      album_name: row.album || 'Supabase Collection',
      album_id: 'supabase-album',
      // If image_url is missing, use a sleek fallback
      album_image: row.image_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&q=80',
      duration: row.duration || 0,
      audio: row.audio_url,
      audiodownload: row.audio_url,
      image: row.image_url || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&q=80',
      releasedate: row.created_at || '',
      position: 1,
      category: row.category,
      tags: row.tags,
      provider: this.id
    };
  }
}
