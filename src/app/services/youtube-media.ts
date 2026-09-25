// ============================================
// vibeOnly — YouTube playback engine
// ============================================
// Wraps YouTube's official IFrame player so it can be driven like an
// HTMLAudioElement: play()/pause()/currentTime/duration/volume plus the same
// events (play, playing, pause, ended, error, waiting, timeupdate…). The
// PlayerService switches between this and a normal <audio> element.

import { YT_PREFIX } from './youtube.service';

// YT.PlayerState values
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;

export class YouTubeMedia extends EventTarget {
  error: { code: number; message: string } | null = null;

  private player: any = null;
  private ready: Promise<void> | null = null;
  private videoId = '';
  private loadedId = '';
  private startAt = 0;
  private vol = 80;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastDuration = 0;
  private pendingPlay: { resolve: () => void; reject: (e: unknown) => void } | null = null;

  constructor(
    private loadApi: () => Promise<any>,
    private host: () => HTMLElement | null
  ) {
    super();
  }

  // ── HTMLMediaElement-like surface ──

  get src(): string {
    return this.videoId ? `${YT_PREFIX}${this.videoId}` : '';
  }

  set src(value: string) {
    this.videoId = value.startsWith(YT_PREFIX) ? value.slice(YT_PREFIX.length) : '';
    this.error = null;
  }

  get currentTime(): number {
    return this.player?.getCurrentTime?.() || 0;
  }

  set currentTime(t: number) {
    if (this.loadedId === this.videoId) this.player?.seekTo?.(t, true);
    else this.startAt = t;
  }

  get duration(): number {
    return this.player?.getDuration?.() || 0;
  }

  set volume(v: number) {
    this.vol = Math.round(Math.max(0, Math.min(1, v)) * 100);
    this.player?.setVolume?.(this.vol);
    if (this.vol > 0) this.player?.unMute?.();
  }

  load(): void {
    /* the video is loaded on play() */
  }

  async play(): Promise<void> {
    if (!this.videoId) throw new Error('No video');
    await this.ensurePlayer();
    return new Promise((resolve, reject) => {
      this.pendingPlay?.reject(Object.assign(new Error('superseded'), { name: 'AbortError' }));
      this.pendingPlay = { resolve, reject };
      if (this.loadedId !== this.videoId) {
        this.loadedId = this.videoId;
        this.player.loadVideoById({ videoId: this.videoId, startSeconds: this.startAt || 0 });
        this.startAt = 0;
      } else {
        this.player.playVideo();
      }
      // Mobile browsers may refuse to start without a tap on the video itself
      const waitingFor = this.videoId;
      setTimeout(() => {
        if (this.pendingPlay && this.videoId === waitingFor && this.player?.getPlayerState?.() !== PLAYING) {
          this.pendingPlay.reject(Object.assign(new Error('Tap the video to start'), { name: 'NotAllowedError' }));
          this.pendingPlay = null;
        }
      }, 6000);
    });
  }

  pause(): void {
    this.player?.pauseVideo?.();
  }

  /** Stop and forget the current video (when switching to normal audio) */
  stop(): void {
    this.player?.stopVideo?.();
    this.videoId = '';
    this.loadedId = '';
    this.stopTimer();
  }

  /**
   * The page element holding the player is going away (e.g. admin pages):
   * destroy the player but remember the video and position, so the next
   * play() rebuilds it in the new host and carries on.
   */
  detach(): void {
    if (!this.player && !this.ready) return;
    const t = this.currentTime;
    const wasLoaded = this.loadedId === this.videoId;
    this.stopTimer();
    this.pendingPlay?.reject(Object.assign(new Error('Player closed'), { name: 'AbortError' }));
    this.pendingPlay = null;
    try { this.player?.destroy?.(); } catch { /* already gone */ }
    this.player = null;
    this.ready = null;
    this.loadedId = '';
    if (wasLoaded && t > 0) this.startAt = t;
    this.emit('pause');
  }

  /** Load the YouTube player ahead of time so a tap starts playback instantly */
  prepare(): void {
    this.ensurePlayer().catch(() => undefined);
  }

  // ── Internals ──

  private ensurePlayer(): Promise<void> {
    if (!this.ready) {
      this.ready = this.loadApi().then(
        (YT) =>
          new Promise<void>((resolve, reject) => {
            const host = this.host();
            if (!host) {
              this.ready = null;
              reject(new Error('No video host on the page'));
              return;
            }
            const mount = document.createElement('div');
            host.appendChild(mount);
            this.player = new YT.Player(mount, {
              width: '100%',
              height: '100%',
              playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
              events: {
                onReady: () => {
                  this.player.setVolume(this.vol);
                  resolve();
                },
                onStateChange: (e: any) => this.onState(e.data),
                onError: (e: any) => this.onError(e.data),
              },
            });
          })
      );
    }
    return this.ready;
  }

  private onState(state: number): void {
    switch (state) {
      case PLAYING:
        this.pendingPlay?.resolve();
        this.pendingPlay = null;
        this.emit('play');
        this.emit('playing');
        this.emit('canplay');
        this.startTimer();
        break;
      case PAUSED:
        this.emit('pause');
        this.stopTimer();
        break;
      case BUFFERING:
        this.emit('waiting');
        break;
      case ENDED:
        this.stopTimer();
        this.emit('ended');
        break;
    }
  }

  private onError(code: number): void {
    const messages: Record<number, string> = {
      2: 'Invalid video id',
      5: 'Video cannot be played in the browser',
      100: 'Video was removed or is private',
      101: 'The owner does not allow this video to be embedded',
      150: 'The owner does not allow this video to be embedded',
    };
    this.error = { code, message: messages[code] || 'YouTube playback error' };
    this.pendingPlay?.reject(Object.assign(new Error(this.error.message), { name: 'YouTubeError' }));
    this.pendingPlay = null;
    this.emit('error');
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.emit('timeupdate');
      const d = this.duration;
      if (d && d !== this.lastDuration) {
        this.lastDuration = d;
        this.emit('durationchange');
      }
    }, 250);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private emit(type: string): void {
    this.dispatchEvent(new Event(type));
  }
}
