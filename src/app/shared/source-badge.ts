import { Track } from '../models';

/** Icon + label describing where a track streams from */
export function sourceMeta(track: Track): { icon: string; label: string } {
  switch (track.provider) {
    case 'audius': return { icon: 'bi-soundwave', label: 'Full song · Audius' };
    case 'itunes': return { icon: 'bi-apple', label: '30s preview · iTunes' };
    case 'archive': return { icon: 'bi-bank', label: 'Full song · Internet Archive' };
    case 'radio': return { icon: 'bi-broadcast', label: 'Live radio' };
    case 'supabase': return { icon: 'bi-cloud-check-fill', label: 'Your upload' };
    case 'local': return { icon: 'bi-hdd-fill', label: 'Local' };
    default: return { icon: 'bi-music-note', label: track.provider || '' };
  }
}
