// ============================================
// YakBeats — Core Data Models
// ============================================

/** Represents a music track from Jamendo or other sources */
export interface Track {
  id: string;
  name: string;
  artist_name: string;
  artist_id: string;
  album_name: string;
  album_id: string;
  album_image: string;
  duration: number; // seconds
  audio: string; // streaming URL
  audiodownload: string;
  image: string;
  releasedate: string;
  position: number;
  category?: string;
  tags?: string;
  isFavorite?: boolean;
  provider?: string;
  genre?: string;
  mood?: string;
  playCount?: number;
  /** Short clip only (e.g. 30s iTunes preview), not the full song */
  isPreview?: boolean;
  /** Live stream with no fixed duration (radio) */
  isLive?: boolean;
  /** Link to the artist page, e.g. "audius:abc12" or "itunes:1234" */
  artistRef?: string;
  /** Where the full song can be heard (e.g. Apple Music page for a preview) */
  externalUrl?: string;
}

/** An artist from any source */
export interface ArtistSummary {
  ref: string; // "audius:<id>" | "itunes:<id>"
  name: string;
  image: string;
  cover?: string;
  bio?: string;
  followers?: number;
  trackCount?: number;
  verified?: boolean;
}

/** A public playlist or album from a source (e.g. Audius) */
export interface Collection {
  ref: string; // "audius:<id>"
  name: string;
  owner: string;
  image: string;
  description?: string;
  isAlbum?: boolean;
  trackCount?: number;
  tracks?: Track[];
}

/** Represents an artist */
export interface Artist {
  id: string;
  name: string;
  image: string;
  website: string;
  joindate: string;
  shorturl: string;
}

/** Represents an album */
export interface Album {
  id: string;
  name: string;
  artist_name: string;
  artist_id: string;
  image: string;
  releasedate: string;
  zip: string;
}

/** Represents a user-created playlist */
export interface Playlist {
  id: string;
  name: string;
  description: string;
  image: string;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}

/** Music category for browsing */
export interface MusicCategory {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  tag: string; // Jamendo tag for search
  description: string;
  sources?: CategorySources;
  /** Section on the Browse page */
  group?: 'genre' | 'language' | 'mood' | 'radio';
}

/** Where a category pulls its music from */
export interface CategorySources {
  /** Category value your own Supabase uploads use (defaults to the category name) */
  uploads?: string;
  /** Audius genre to pull trending full-length tracks from */
  audiusGenre?: string;
  /** Audius search queries (full-length tracks) */
  audius?: string[];
  /** iTunes search term(s) (30s previews of mainstream songs) */
  itunes?: string | string[];
  /** iTunes storefront, e.g. 'KR' for K-pop (default 'IN') */
  itunesCountry?: string;
  /** Radio Browser tag/region (live streams) */
  radio?: string;
  /** Internet Archive search query (full-length, public domain) */
  archive?: string;
  /** YouTube search(es) used when a YouTube key is set (languages default to "<name> songs") */
  youtube?: string | string[];
  /**
   * Keywords a full-length (Audius) result must mention in its title, artist,
   * tags or genre. Keeps niche categories from filling up with loose matches.
   */
  match?: string[];
}

/** Player state */
export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  queue: Track[];
  queueIndex: number;
}

/** API response wrapper from Jamendo */
export interface JamendoResponse<T> {
  headers: {
    status: string;
    code: number;
    error_message: string;
    warnings: string;
    results_count: number;
    next: string;
  };
  results: T[];
}

/** Theme type */
export type ThemeMode = 'dark' | 'light';
