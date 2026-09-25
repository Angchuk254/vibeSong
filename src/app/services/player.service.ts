// ============================================
// vibeOnly — Audio Player Service
// ============================================

import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Track } from '../models';
import { StorageService } from './storage.service';
import { MusicApiService } from './music-api.service';

/** How long a track may sit loading before we give up on it */
const LOAD_TIMEOUT_MS = 15000;
/** Stop auto-skipping after this many broken tracks in a row */
const MAX_CONSECUTIVE_FAILURES = 6;

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private storage = inject(StorageService);
  private musicApi = inject(MusicApiService);
  private audio = new Audio();

  // ── Signals ──
  readonly currentTrack = signal<Track | null>(null);
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly volume = signal(0.8);
  readonly isMuted = signal(false);
  readonly isShuffled = signal(false);
  readonly repeatMode = signal<'none' | 'one' | 'all'>('none');
  readonly queue = signal<Track[]>([]);
  readonly queueIndex = signal(-1);
  readonly isLoading = signal(false);
  readonly isPlayerVisible = signal(false);
  /** Keep playing similar music when the queue runs out */
  readonly autoplay = signal(true);
  /** Epoch ms when the sleep timer fires, or 'track' to stop after the current song */
  readonly sleepAt = signal<number | 'track' | null>(null);
  /** Short message for the UI (skipped tracks, sleep timer…) */
  readonly notice = signal<string | null>(null);
  /** Bumped whenever favorites change so views can refresh */
  readonly favoritesVersion = signal(0);

  // ── Computed ──
  readonly isLive = computed(() => {
    const t = this.currentTrack();
    return !!t && (t.isLive || t.provider === 'radio');
  });

  readonly progress = computed(() => {
    const dur = this.duration();
    return dur > 0 && isFinite(dur) ? (this.currentTime() / dur) * 100 : 0;
  });

  readonly formattedCurrentTime = computed(() =>
    this.formatTime(this.currentTime())
  );

  readonly formattedDuration = computed(() =>
    this.isLive() ? 'LIVE' : this.formatTime(this.duration())
  );

  readonly hasNext = computed(
    () => this.queueIndex() < this.queue().length - 1
  );

  readonly hasPrevious = computed(() => this.queueIndex() > 0);

  readonly upNext = computed(() => this.queue().slice(this.queueIndex() + 1));

  private failedIds = new Set<string>();
  private consecutiveFailures = 0;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private fetchingAutoplay = false;
  /** Queue order before shuffle, so turning shuffle off restores it */
  private unshuffledQueue: Track[] | null = null;
  private pendingSeek: number | null = null;
  private lastSave = 0;

  constructor() {
    this.setupAudioEvents();
    this.restoreVolume();
    this.restoreSession();
    this.setupMediaSession();

    effect(() => this.storage.savePlayerPrefs({
      shuffle: this.isShuffled(),
      repeat: this.repeatMode(),
      autoplay: this.autoplay(),
    }));
  }

  // ── Public Methods ──

  /**
   * Play a single track, optionally replacing the queue with the list it came from
   */
  playTrack(track: Track, trackList?: Track[]): void {
    this.consecutiveFailures = 0;
    this.failedIds.delete(track.id);

    if (trackList && trackList.length > 0) {
      this.unshuffledQueue = null;
      let list = [...trackList];
      if (this.isShuffled()) {
        this.unshuffledQueue = list;
        list = [track, ...this.shuffle(list.filter((t) => t.id !== track.id))];
      }
      this.queue.set(list);
      const idx = list.findIndex((t) => t.id === track.id);
      this.queueIndex.set(idx >= 0 ? idx : 0);
    } else {
      const idx = this.queue().findIndex((t) => t.id === track.id);
      if (idx >= 0) {
        this.queueIndex.set(idx);
      } else {
        this.queue.update((q) => [...q, track]);
        this.queueIndex.set(this.queue().length - 1);
      }
    }

    this.loadAndPlay(track);
  }

  /** Play a list from the top (or shuffled) */
  playAll(tracks: Track[], shuffled = false): void {
    if (!tracks.length) return;
    if (shuffled) this.isShuffled.set(true);
    const first = shuffled ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
    this.playTrack(first, tracks);
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (!this.currentTrack()) return;
    if (this.isPlaying()) {
      this.audio.pause();
    } else {
      if (!this.audio.src) {
        this.loadAndPlay(this.currentTrack()!);
        return;
      }
      this.audio.play().catch((err) => this.handleFailure(err));
    }
  }

  /**
   * Play next track in queue
   */
  playNext(auto = false): void {
    const q = this.queue();
    const nextIdx = this.queueIndex() + 1;

    if (nextIdx < q.length) {
      this.queueIndex.set(nextIdx);
      this.loadAndPlay(q[nextIdx]);
    } else if (this.repeatMode() === 'all' && q.length > 0) {
      this.queueIndex.set(0);
      this.loadAndPlay(q[0]);
    } else if (this.autoplay()) {
      this.extendWithSimilar(true);
    } else if (auto) {
      this.isPlaying.set(false);
    }
  }

  /**
   * Play previous track in queue
   */
  playPrevious(): void {
    if (this.currentTime() > 3 && !this.isLive()) {
      this.audio.currentTime = 0;
      return;
    }

    const prevIdx = this.queueIndex() - 1;
    if (prevIdx >= 0) {
      const q = this.queue();
      this.queueIndex.set(prevIdx);
      this.loadAndPlay(q[prevIdx]);
    }
  }

  /** Jump to a position in the queue */
  playAt(index: number): void {
    const q = this.queue();
    if (index < 0 || index >= q.length) return;
    this.consecutiveFailures = 0;
    this.queueIndex.set(index);
    this.loadAndPlay(q[index]);
  }

  /**
   * Seek to position (0-100)
   */
  seekTo(percentage: number): void {
    const dur = this.duration();
    if (dur > 0 && isFinite(dur)) {
      this.audio.currentTime = (percentage / 100) * dur;
    }
  }

  /** Jump to an exact time in seconds */
  seekToTime(seconds: number): void {
    const dur = this.duration();
    if (dur > 0 && isFinite(dur)) this.audio.currentTime = Math.max(0, Math.min(dur - 0.5, seconds));
  }

  /** Skip forward/back by seconds */
  seekBy(seconds: number): void {
    const dur = this.duration();
    if (!(dur > 0 && isFinite(dur))) return;
    this.audio.currentTime = Math.max(0, Math.min(dur - 0.5, this.audio.currentTime + seconds));
  }

  /**
   * Set volume (0-1)
   */
  setVolume(vol: number): void {
    const v = Math.max(0, Math.min(1, vol));
    this.volume.set(v);
    this.audio.volume = v;
    this.isMuted.set(v === 0);
    this.storage.saveVolume(v);
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    if (this.isMuted()) {
      const restored = this.storage.getVolume() || 0.8;
      this.audio.volume = restored;
      this.volume.set(restored);
      this.isMuted.set(false);
    } else {
      this.audio.volume = 0;
      this.isMuted.set(true);
    }
  }

  /**
   * Toggle shuffle. Shuffles what's left of the queue, and restores the
   * original order when turned off.
   */
  toggleShuffle(): void {
    const q = this.queue();
    const idx = this.queueIndex();
    const current = q[idx];

    if (!this.isShuffled()) {
      this.unshuffledQueue = q;
      const rest = this.shuffle(q.slice(idx + 1));
      this.queue.set([...q.slice(0, idx + 1), ...rest]);
      this.isShuffled.set(true);
    } else {
      if (this.unshuffledQueue) {
        const known = new Set(this.unshuffledQueue.map((t) => t.id));
        const added = q.filter((t) => !known.has(t.id));
        const restored = [...this.unshuffledQueue, ...added];
        this.queue.set(restored);
        if (current) this.queueIndex.set(restored.findIndex((t) => t.id === current.id));
      }
      this.unshuffledQueue = null;
      this.isShuffled.set(false);
    }
    this.saveSession();
  }

  /**
   * Cycle repeat mode
   */
  cycleRepeat(): void {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all'];
    const current = modes.indexOf(this.repeatMode());
    this.repeatMode.set(modes[(current + 1) % modes.length]);
  }

  toggleAutoplay(): void {
    this.autoplay.update((v) => !v);
  }

  /**
   * Add tracks to the end of the queue
   */
  addToQueue(tracks: Track[]): void {
    const existing = new Set(this.queue().map((t) => t.id));
    const fresh = tracks.filter((t) => !existing.has(t.id));
    if (!fresh.length) return;
    this.queue.update((q) => [...q, ...fresh]);
    this.flash(fresh.length === 1 ? `Added "${fresh[0].name}" to queue` : `Added ${fresh.length} songs to queue`);
    if (!this.currentTrack()) this.playAt(this.queue().length - fresh.length);
    this.saveSession();
  }

  /** Insert a track right after the current one */
  playNextInQueue(track: Track): void {
    if (!this.currentTrack()) {
      this.playTrack(track);
      return;
    }
    const q = this.queue().filter((t) => t.id !== track.id);
    const idx = q.findIndex((t) => t.id === this.currentTrack()!.id);
    q.splice(idx + 1, 0, track);
    this.queue.set(q);
    this.queueIndex.set(idx);
    this.flash(`"${track.name}" plays next`);
    this.saveSession();
  }

  removeFromQueue(index: number): void {
    const idx = this.queueIndex();
    if (index === idx) return;
    this.queue.update((q) => q.filter((_, i) => i !== index));
    if (index < idx) this.queueIndex.set(idx - 1);
    this.saveSession();
  }

  /** Move a queued track up (-1) or down (+1) */
  moveInQueue(index: number, delta: number): void {
    const q = [...this.queue()];
    const to = index + delta;
    if (to < 0 || to >= q.length) return;
    [q[index], q[to]] = [q[to], q[index]];
    const idx = this.queueIndex();
    this.queue.set(q);
    if (idx === index) this.queueIndex.set(to);
    else if (idx === to) this.queueIndex.set(index);
    this.saveSession();
  }

  /**
   * Clear everything after the current track
   */
  clearQueue(): void {
    const current = this.currentTrack();
    if (current) {
      this.queue.set([current]);
      this.queueIndex.set(0);
    } else {
      this.queue.set([]);
      this.queueIndex.set(-1);
    }
    this.unshuffledQueue = null;
    this.saveSession();
  }

  // ── Favorites (kept here so every view stays in sync) ──

  isFavorite(trackId: string): boolean {
    this.favoritesVersion();
    return this.storage.isFavorite(trackId);
  }

  toggleFavorite(track: Track): boolean {
    const result = this.storage.toggleFavorite(track);
    this.favoritesVersion.update((v) => v + 1);
    this.flash(result ? 'Added to Liked Songs' : 'Removed from Liked Songs');
    return result;
  }

  // ── Sleep timer ──

  setSleepTimer(minutes: number | 'track' | null): void {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null;

    if (minutes === null) {
      this.sleepAt.set(null);
      this.flash('Sleep timer off');
    } else if (minutes === 'track') {
      this.sleepAt.set('track');
      this.flash('Stopping after this song');
    } else {
      this.sleepAt.set(Date.now() + minutes * 60000);
      this.sleepTimer = setTimeout(() => this.sleepNow(), minutes * 60000);
      this.flash(`Sleep timer: ${minutes} min`);
    }
  }

  // ── Private Methods ──

  private sleepNow(): void {
    this.audio.pause();
    this.sleepAt.set(null);
    this.sleepTimer = null;
    this.flash('Sleep timer ended — good night');
  }

  private loadAndPlay(track: Track, startAt = 0): void {
    this.clearLoadTimer();
    this.isLoading.set(true);
    this.currentTrack.set(track);
    this.isPlayerVisible.set(true);
    this.currentTime.set(0);
    this.duration.set(track.duration || 0);
    this.pendingSeek = startAt > 0 ? startAt : null;
    this.audio.src = track.audio;
    this.audio.load();
    this.updateMediaSession(track);
    this.saveSession();

    this.loadTimer = setTimeout(() => {
      if (this.currentTrack()?.id === track.id && this.isLoading() && !this.isPlaying()) {
        this.handleFailure(new Error('Timed out loading'));
      }
    }, LOAD_TIMEOUT_MS);

    this.audio
      .play()
      .then(() => {
        if (this.currentTrack()?.id !== track.id) return;
        this.consecutiveFailures = 0;
        this.storage.addRecentTrack(track);
        this.storage.recordPlay(track);
      })
      .catch((err) => {
        // Autoplay policy: the browser wants a tap first. Not a broken track.
        if (err?.name === 'NotAllowedError') {
          this.clearLoadTimer();
          this.isLoading.set(false);
          this.isPlaying.set(false);
          return;
        }
        if (err?.name === 'AbortError') return; // superseded by another load
        // A stale rejection from a track we've already moved past
        if (this.currentTrack()?.id !== track.id) return;
        this.handleFailure(err);
      });

    this.maybePrefetchAutoplay();
  }

  /** Skip tracks that can't be played instead of leaving the player stuck */
  private handleFailure(err: unknown): void {
    const track = this.currentTrack();
    this.clearLoadTimer();
    console.warn('[PlayerService] Could not play', track?.name, err);
    this.isPlaying.set(false);
    this.isLoading.set(false);
    // play() rejecting and the 'error' event both report the same failure
    if (!track || this.failedIds.has(track.id)) return;

    this.failedIds.add(track.id);
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.flash('Several songs in a row failed to load — check your connection');
      this.consecutiveFailures = 0;
      return;
    }

    // Drop the broken track so it doesn't come round again
    const idx = this.queueIndex();
    this.queue.update((q) => q.filter((t) => t.id !== track.id));
    this.queueIndex.set(idx - 1);
    this.flash(`Skipped "${track.name}" — unavailable`);
    this.playNext(true);
  }

  /** Appends similar music to the queue, optionally starting it */
  private extendWithSimilar(startPlaying: boolean): void {
    const seed = this.currentTrack();
    if (!seed || this.fetchingAutoplay) return;
    this.fetchingAutoplay = true;
    if (startPlaying) this.isLoading.set(true);

    this.musicApi.getSimilarTracks(seed, 15).subscribe({
      next: (tracks) => {
        this.fetchingAutoplay = false;
        const inQueue = new Set(this.queue().map((t) => t.id));
        const fresh = tracks.filter((t) => !inQueue.has(t.id) && !this.failedIds.has(t.id)).slice(0, 10);
        if (!fresh.length) {
          if (startPlaying) {
            this.isLoading.set(false);
            this.isPlaying.set(false);
          }
          return;
        }
        this.queue.update((q) => [...q, ...fresh]);
        if (startPlaying) this.playNext(true);
        else this.saveSession();
      },
      error: () => {
        this.fetchingAutoplay = false;
        if (startPlaying) this.isLoading.set(false);
      },
    });
  }

  /** Top up the queue in the background when we're near the end */
  private maybePrefetchAutoplay(): void {
    if (!this.autoplay() || this.repeatMode() !== 'none') return;
    if (this.queue().length - this.queueIndex() <= 2) this.extendWithSimilar(false);
  }

  private setupAudioEvents(): void {
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.audio.currentTime);
      if (Date.now() - this.lastSave > 5000) this.saveSession();
    });

    this.audio.addEventListener('durationchange', () => {
      const d = this.audio.duration;
      this.duration.set(isFinite(d) ? d : 0);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeek !== null) {
        this.audio.currentTime = this.pendingSeek;
        this.pendingSeek = null;
      }
    });

    this.audio.addEventListener('play', () => this.isPlaying.set(true));
    this.audio.addEventListener('playing', () => {
      this.clearLoadTimer();
      this.isPlaying.set(true);
      this.isLoading.set(false);
    });
    this.audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
      this.saveSession();
    });

    this.audio.addEventListener('ended', () => {
      if (this.sleepAt() === 'track') {
        this.sleepNow();
        return;
      }
      if (this.repeatMode() === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.error);
      } else {
        this.playNext(true);
      }
    });

    this.audio.addEventListener('error', () => {
      // Ignore errors from clearing src
      if (!this.audio.src || this.audio.src === location.href) return;
      this.handleFailure(this.audio.error);
    });

    this.audio.addEventListener('waiting', () => {
      this.isLoading.set(true);
    });

    this.audio.addEventListener('canplay', () => {
      this.isLoading.set(false);
    });
  }

  // ── Lock screen / headphone controls ──

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.togglePlay()],
      ['pause', () => this.togglePlay()],
      ['previoustrack', () => this.playPrevious()],
      ['nexttrack', () => this.playNext()],
      ['seekbackward', () => this.seekBy(-10)],
      ['seekforward', () => this.seekBy(10)],
      ['seekto', (d) => d.seekTime !== undefined && (this.audio.currentTime = d.seekTime)],
    ];
    handlers.forEach(([action, handler]) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* action not supported in this browser */
      }
    });
  }

  private updateMediaSession(track: Track): void {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const art = track.album_image || track.image;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artist_name,
      album: track.isLive ? 'Live Radio' : track.album_name,
      artwork: art ? [{ src: art, sizes: '512x512' }] : [],
    });
  }

  // ── Persistence ──

  private saveSession(): void {
    this.lastSave = Date.now();
    this.storage.savePlayerSession({
      queue: this.queue().slice(0, 200),
      index: this.queueIndex(),
      time: this.isLive() ? 0 : this.audio.currentTime || 0,
    });
  }

  /** Bring back the last queue after a reload, paused where you left off */
  private restoreSession(): void {
    const prefs = this.storage.getPlayerPrefs();
    if (prefs) {
      this.isShuffled.set(!!prefs.shuffle);
      this.repeatMode.set(prefs.repeat || 'none');
      this.autoplay.set(prefs.autoplay !== false);
    }

    const session = this.storage.getPlayerSession();
    if (!session?.queue?.length) return;
    const index = Math.min(Math.max(session.index, 0), session.queue.length - 1);
    const track = session.queue[index];
    this.queue.set(session.queue);
    this.queueIndex.set(index);
    this.currentTrack.set(track);
    this.duration.set(track.duration || 0);
    this.currentTime.set(session.time || 0);
    this.isPlayerVisible.set(true);
    this.audio.preload = 'none';
    this.audio.src = track.audio;
    if (session.time && !track.isLive) this.pendingSeek = session.time;
    this.updateMediaSession(track);
  }

  private restoreVolume(): void {
    const vol = this.storage.getVolume();
    if (vol !== null) {
      this.volume.set(vol);
      this.audio.volume = vol;
    } else {
      this.audio.volume = 0.8;
    }
  }

  private flash(message: string): void {
    this.notice.set(message);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 3000);
  }

  private clearLoadTimer(): void {
    if (this.loadTimer) clearTimeout(this.loadTimer);
    this.loadTimer = null;
  }

  private shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private formatTime(seconds: number): string {
    if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
