import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Track } from '../../models';
import { MusicProvider } from './music-provider.interface';

@Injectable({ providedIn: 'root' })
export class LocalProvider implements MusicProvider {
  id = 'local';
  name = 'Local Library';

  // Reliable public domain/free tracks to ensure playback ALWAYS works
  private localTracks: Track[] = [
    {
      id: 'local-1',
      name: 'Himalayan Morning Breeze',
      artist_name: 'SoundHelix',
      artist_id: 'local-artist-1',
      album_name: 'Offline Vibes',
      album_id: 'local-album-1',
      album_image: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=400&q=80',
      duration: 372,
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      audiodownload: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      image: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?w=400&q=80',
      releasedate: '2026-01-01',
      position: 1,
      provider: 'local'
    },
    {
      id: 'local-2',
      name: 'Tibetan Bowl Resonance',
      artist_name: 'SoundHelix',
      artist_id: 'local-artist-1',
      album_name: 'Offline Vibes',
      album_id: 'local-album-1',
      album_image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
      duration: 425,
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      audiodownload: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
      releasedate: '2026-01-01',
      position: 2,
      provider: 'local'
    },
    {
      id: 'local-3',
      name: 'Evening Mantra',
      artist_name: 'SoundHelix',
      artist_id: 'local-artist-1',
      album_name: 'Offline Vibes',
      album_id: 'local-album-1',
      album_image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
      duration: 344,
      audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      audiodownload: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
      releasedate: '2026-01-01',
      position: 3,
      provider: 'local'
    }
  ];

  getTrendingTracks(limit = 20): Observable<Track[]> {
    return of(this.localTracks).pipe(delay(300));
  }

  getTracksByTag(tag: string, limit = 20): Observable<Track[]> {
    return of(this.localTracks).pipe(delay(300));
  }

  searchTracks(query: string, limit = 20): Observable<Track[]> {
    const filtered = this.localTracks.filter(t => 
      t.name.toLowerCase().includes(query.toLowerCase()) || 
      t.artist_name.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered).pipe(delay(300));
  }

  getFeaturedTracks(limit = 15): Observable<Track[]> {
    return of(this.localTracks).pipe(delay(300));
  }
}

