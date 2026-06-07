// ============================================
// vibeOnly — Audio Player Service
// ============================================

import { Injectable, signal, computed, inject } from '@angular/core';
import { Track } from '../models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private storage = inject(StorageService);
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

  // ── Computed ──
  readonly progress = computed(() => {
    const dur = this.duration();
    return dur > 0 ? (this.currentTime() / dur) * 100 : 0;
  });

  readonly formattedCurrentTime = computed(() =>
    this.formatTime(this.currentTime())
  );

  readonly formattedDuration = computed(() =>
    this.formatTime(this.duration())
  );

  readonly hasNext = computed(
    () => this.queueIndex() < this.queue().length - 1
  );

  readonly hasPrevious = computed(() => this.queueIndex() > 0);

  constructor() {
    this.setupAudioEvents();
    this.restoreVolume();
  }

  // ── Public Methods ──

  /**
   * Play a single track
   */
  playTrack(track: Track, trackList?: Track[]): void {
    if (trackList && trackList.length > 0) {
      this.queue.set(trackList);
      const idx = trackList.findIndex((t) => t.id === track.id);
      this.queueIndex.set(idx >= 0 ? idx : 0);
    } else {
      if (!this.queue().find((t) => t.id === track.id)) {
        this.queue.update((q) => [...q, track]);
        this.queueIndex.set(this.queue().length - 1);
      }
    }

    this.loadAndPlay(track);
    this.storage.addRecentTrack(track);
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (!this.currentTrack()) return;
    if (this.isPlaying()) {
      this.audio.pause();
      this.isPlaying.set(false);
    } else {
      this.audio.play().catch(console.error);
      this.isPlaying.set(true);
    }
  }

  /**
   * Play next track in queue
   */
  playNext(): void {
    const q = this.queue();
    let nextIdx = this.queueIndex() + 1;

    if (this.isShuffled()) {
      nextIdx = Math.floor(Math.random() * q.length);
    }

    if (nextIdx < q.length) {
      this.queueIndex.set(nextIdx);
      this.loadAndPlay(q[nextIdx]);
      this.storage.addRecentTrack(q[nextIdx]);
    } else if (this.repeatMode() === 'all' && q.length > 0) {
      this.queueIndex.set(0);
      this.loadAndPlay(q[0]);
      this.storage.addRecentTrack(q[0]);
    }
  }

  /**
   * Play previous track in queue
   */
  playPrevious(): void {
    if (this.currentTime() > 3) {
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

  /**
   * Seek to position (0-100)
   */
  seekTo(percentage: number): void {
    const dur = this.duration();
    if (dur > 0) {
      this.audio.currentTime = (percentage / 100) * dur;
    }
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
   * Toggle shuffle
   */
  toggleShuffle(): void {
    this.isShuffled.update((v) => !v);
  }

  /**
   * Cycle repeat mode
   */
  cycleRepeat(): void {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all'];
    const current = modes.indexOf(this.repeatMode());
    this.repeatMode.set(modes[(current + 1) % modes.length]);
  }

  /**
   * Add tracks to queue
   */
  addToQueue(tracks: Track[]): void {
    this.queue.update((q) => [...q, ...tracks]);
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue.set([]);
    this.queueIndex.set(-1);
  }

  // ── Private Methods ──

  private loadAndPlay(track: Track): void {
    this.isLoading.set(true);
    this.currentTrack.set(track);
    this.isPlayerVisible.set(true);
    this.audio.src = track.audio;
    this.audio.load();
    this.audio
      .play()
      .then(() => {
        this.isPlaying.set(true);
        this.isLoading.set(false);
      })
      .catch((err) => {
        console.error('[PlayerService] Play failed:', err);
        this.isPlaying.set(false);
        this.isLoading.set(false);
      });
  }

  private setupAudioEvents(): void {
    this.audio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.audio.currentTime);
    });

    this.audio.addEventListener('durationchange', () => {
      this.duration.set(this.audio.duration || 0);
    });

    this.audio.addEventListener('ended', () => {
      if (this.repeatMode() === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(console.error);
      } else {
        this.playNext();
      }
    });

    this.audio.addEventListener('error', () => {
      console.error('[PlayerService] Audio error');
      this.isPlaying.set(false);
      this.isLoading.set(false);
    });

    this.audio.addEventListener('waiting', () => {
      this.isLoading.set(true);
    });

    this.audio.addEventListener('canplay', () => {
      this.isLoading.set(false);
    });
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

  private formatTime(seconds: number): string {
    if (seconds === undefined || seconds === null || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
