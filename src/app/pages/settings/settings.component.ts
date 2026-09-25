import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ShareCardComponent } from '../../shared/share-card/share-card.component';
import { ThemeService, MusicApiService, DeviceMusicService, YouTubeService, PlayerService, LocationService } from '../../services';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ShareCardComponent],
  template: `
    <div class="settings-page vo-fade-in">
      <header class="settings-header">
        <h1>Settings</h1>
        <p>Manage your preferences and app data</p>
      </header>

      <div class="settings-content">
        <!-- Appearance -->
        <div class="settings-section">
          <h2 class="section-title">Appearance</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row" tabindex="0" role="button" (click)="theme.toggleTheme()" (keydown.enter)="theme.toggleTheme()">
              <div class="setting-icon appearance">
                <i class="bi" [class.bi-moon-stars-fill]="theme.isDark()" [class.bi-sun-fill]="!theme.isDark()"></i>
              </div>
              <div class="setting-label">
                <h3>Dark Mode</h3>
                <p>Currently using {{ theme.isDark() ? 'Dark' : 'Light' }} theme</p>
              </div>
              <div class="toggle-switch" [class.active]="theme.isDark()">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Share -->
        <div class="settings-section">
          <h2 class="section-title">Share vibeOnly</h2>
          <div class="settings-card glass-panel">
            <app-share-card></app-share-card>
          </div>
        </div>

        <!-- Home -->
        <div class="settings-section">
          <h2 class="section-title">Home</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row" tabindex="0" role="switch" [attr.aria-checked]="location.enabled()"
                 (click)="location.setEnabled(!location.enabled())"
                 (keydown.enter)="location.setEnabled(!location.enabled())">
              <div class="setting-icon appearance"><i class="bi bi-geo-alt-fill"></i></div>
              <div class="setting-label">
                <h3>Show my city</h3>
                <p>
                  @if (location.enabled() && location.label()) {
                    Showing "{{ location.label() }}" ({{ location.place()?.source === 'gps' ? 'device location' : location.place()?.source === 'ip' ? 'from your IP' : 'default' }}) ·
                  }
                  Detected automatically: device location if allowed, otherwise your internet connection (IP), otherwise Leh. Only the city name is kept on this device.
                </p>
              </div>
              <div class="toggle-switch" [class.active]="location.enabled()"><div class="toggle-knob"></div></div>
            </div>
          </div>
        </div>

        <!-- Playback -->
        <div class="settings-section">
          <h2 class="section-title">Playback</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row" tabindex="0" role="switch" [attr.aria-checked]="musicApi.hidePreviews()"
                 (click)="musicApi.setHidePreviews(!musicApi.hidePreviews())"
                 (keydown.enter)="musicApi.setHidePreviews(!musicApi.hidePreviews())">
              <div class="setting-icon appearance">
                <i class="bi bi-scissors"></i>
              </div>
              <div class="setting-label">
                <h3>Full songs only</h3>
                <p>Hide 30-second iTunes previews everywhere (fewer Bollywood/Punjabi results)</p>
              </div>
              <div class="toggle-switch" [class.active]="musicApi.hidePreviews()">
                <div class="toggle-knob"></div>
              </div>
            </div>
            <div class="setting-row" tabindex="0" role="button" (click)="openDevice()" (keydown.enter)="openDevice()">
              <div class="setting-icon appearance">
                <i class="bi bi-phone"></i>
              </div>
              <div class="setting-label">
                <h3>Songs on this device</h3>
                <p>{{ device.count() }} songs · add your own MP3s</p>
              </div>
              <i class="bi bi-chevron-right arrow"></i>
            </div>
          </div>
        </div>

        <!-- YouTube -->
        <div class="settings-section">
          <h2 class="section-title">Full songs from YouTube</h2>
          <div class="settings-card glass-panel yt-card">
            <p class="yt-intro">
              Songs play through YouTube's official player, so almost any song — Ladakhi, Spiti, Himachali, Bollywood —
              plays in full. Without a key you can paste YouTube links in <a (click)="openDevice()" (keydown.enter)="openDevice()" tabindex="0">Library → My Songs</a>.
              With a free key the app also searches YouTube for you and turns 30-second previews into full songs.
            </p>

            <form class="yt-key" (submit)="saveKey($event)">
              <input #keyInput type="password" autocomplete="off" placeholder="Paste your YouTube API key"
                     [value]="keyDraft()" (input)="keyDraft.set(keyInput.value)" aria-label="YouTube API key" />
              <button class="vo-btn vo-btn-primary" type="submit" [disabled]="keyState() === 'checking'">
                {{ keyState() === 'checking' ? 'Checking…' : 'Save' }}
              </button>
              @if (youtube.hasKey()) {
                <button class="vo-btn vo-btn-ghost" type="button" (click)="removeKey()">Remove</button>
              }
            </form>
            @if (keyState() === 'ok' || (keyState() === 'idle' && youtube.hasKey())) {
              <p class="yt-status ok"><i class="bi bi-check-circle-fill"></i> Key active — YouTube search is on.</p>
            } @else if (keyState() === 'bad') {
              <p class="yt-status bad"><i class="bi bi-x-circle-fill"></i> That key didn't work. Check it's copied fully and that "YouTube Data API v3" is enabled.</p>
            }

            <div class="setting-row" tabindex="0" role="switch" [attr.aria-checked]="player.autoFullVersion()"
                 (click)="player.setAutoFullVersion(!player.autoFullVersion())"
                 (keydown.enter)="player.setAutoFullVersion(!player.autoFullVersion())">
              <div class="setting-icon appearance"><i class="bi bi-youtube"></i></div>
              <div class="setting-label">
                <h3>Play previews in full</h3>
                <p>When a 30-second preview is played, play the full song from YouTube instead (needs the key)</p>
              </div>
              <div class="toggle-switch" [class.active]="player.autoFullVersion()"><div class="toggle-knob"></div></div>
            </div>

          </div>
        </div>

        <!-- Account & Management (Desktop Only) -->
        <div class="settings-section vo-desktop-only">
          <h2 class="section-title">Administration</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row" tabindex="0" role="button" (click)="openAdmin()" (keydown.enter)="openAdmin()">
              <div class="setting-icon admin">
                <i class="bi bi-shield-lock-fill"></i>
              </div>
              <div class="setting-label">
                <h3>Admin Portal</h3>
                <p>Access music management and uploads</p>
              </div>
              <i class="bi bi-chevron-right arrow"></i>
            </div>
          </div>
        </div>

        <!-- App Data -->
        <div class="settings-section">
          <h2 class="section-title">Data & Storage</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row" tabindex="0" role="button" (click)="clearCache()" (keydown.enter)="clearCache()">
              <div class="setting-icon danger">
                <i class="bi bi-trash3-fill"></i>
              </div>
              <div class="setting-label">
                <h3>Clear Cache</h3>
                <p>Reset local history and favorites</p>
              </div>
              <span class="action-text">Reset</span>
            </div>
          </div>
        </div>

        <!-- About -->
        <div class="settings-section">
          <h2 class="section-title">About</h2>
          <div class="settings-card glass-panel">
            <div class="setting-row">
              <div class="setting-icon info">
                <i class="bi bi-info-circle-fill"></i>
              </div>
              <div class="setting-label">
                <h3>App Version</h3>
                <p>VibeOnly PWA Stable Release</p>
              </div>
              <span class="badge">v1.0.5</span>
            </div>
            
            <div class="setting-row">
              <div class="setting-icon dev">
                <i class="bi bi-code-slash"></i>
              </div>
              <div class="setting-label">
                <h3>Developer</h3>
                <p>Built with ❤️ for the Himalayas</p>
              </div>
              <span class="action-text">Stakker</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      padding: 24px;
      max-width: 650px;
      margin: 0 auto;
      padding-bottom: 120px;
    }

    @media (max-width: 576px) {
      .settings-page { padding: 4px 0 140px; }
      .settings-header { margin-bottom: 24px; }
      .setting-row { padding: 14px; gap: 12px; }
      .settings-card { border-radius: var(--vo-radius-lg); }
    }

    .settings-header {
      margin-bottom: 40px;
      h1 {
        font-size: 2.8rem;
        font-weight: 900;
        margin: 0;
        background: var(--vo-gradient-accent);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -1px;
      }
      p {
        color: var(--vo-text-muted);
        margin: 4px 0 0;
        font-size: 1.1rem;
      }
    }

    .settings-content {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .section-title {
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--vo-text-muted);
      margin-bottom: 12px;
      padding-left: 4px;
    }

    .settings-card {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }

    .setting-row {
      display: flex;
      align-items: center;
      padding: 16px 20px;
      gap: 16px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);

      &:last-child {
        border-bottom: none;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.04);
      }
    }

    .setting-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;

      &.admin { background: rgba(108, 92, 231, 0.15); color: #a29bfe; }
      &.danger { background: rgba(255, 71, 87, 0.15); color: #ff4757; }
      &.info { background: rgba(0, 184, 148, 0.15); color: #55efc4; }
      &.dev { background: rgba(250, 204, 21, 0.15); color: #facc15; }
      &.appearance { background: rgba(108, 92, 231, 0.15); color: var(--vo-accent-light); }
    }

    .toggle-switch {
      width: 44px;
      height: 24px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      position: relative;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      
      &.active {
        background: var(--vo-accent);
        
        .toggle-knob {
          left: 22px;
          background: #fff;
          box-shadow: 0 0 10px rgba(255,255,255,0.5);
        }
      }
    }

    .toggle-knob {
      width: 18px;
      height: 18px;
      background: var(--vo-text-muted);
      border-radius: 50%;
      position: absolute;
      top: 3px;
      left: 4px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .setting-label {
      flex: 1;
      h3 {
        font-size: 1.05rem;
        font-weight: 600;
        margin: 0;
        color: var(--vo-text-primary);
      }
      p {
        font-size: 0.85rem;
        margin: 2px 0 0;
        color: var(--vo-text-muted);
      }
    }

    .arrow {
      color: var(--vo-text-muted);
      font-size: 0.9rem;
      opacity: 0.5;
    }

    .action-text {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--vo-accent-light);
    }

    .badge {
      padding: 4px 12px;
      background: rgba(108, 92, 231, 0.2);
      color: #a29bfe;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid rgba(108, 92, 231, 0.2);
    }

    .yt-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .yt-intro {
      margin: 0;
      font-size: 0.88rem;
      color: var(--vo-text-secondary);
      line-height: 1.5;

      a { color: var(--vo-accent-light); cursor: pointer; }
    }

    .yt-key {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      input {
        flex: 1;
        min-width: 200px;
        height: 42px;
        padding: 0 14px;
        border-radius: var(--vo-radius-md);
        border: 1px solid var(--vo-border-light);
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
        outline: none;

        &:focus { border-color: var(--vo-accent); }
      }
    }

    .yt-status {
      margin: 0;
      font-size: 0.85rem;

      &.ok { color: var(--vo-secondary); }
      &.bad { color: #ff6b6b; }
    }

  `]
})
export class SettingsComponent {
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly musicApi = inject(MusicApiService);
  readonly device = inject(DeviceMusicService);
  readonly youtube = inject(YouTubeService);
  readonly player = inject(PlayerService);
  readonly location = inject(LocationService);
  readonly origin = location.origin + location.pathname.replace(/\/settings.*$/, '');
  readonly keyDraft = signal('');
  readonly keyState = signal<'idle' | 'checking' | 'ok' | 'bad'>('idle');

  saveKey(e: Event) {
    e.preventDefault();
    const key = this.keyDraft().trim();
    if (!key) return;
    this.keyState.set('checking');
    this.youtube.testKey(key).subscribe((ok) => {
      this.keyState.set(ok ? 'ok' : 'bad');
      if (ok) {
        this.youtube.setApiKey(key);
        this.musicApi.clearCache();
        this.keyDraft.set('');
      }
    });
  }

  removeKey() {
    this.youtube.setApiKey('');
    this.musicApi.clearCache();
    this.keyState.set('idle');
  }

  openDevice() {
    this.router.navigate(['/library'], { queryParams: { tab: 'device' } });
  }

  openAdmin() {
    this.router.navigate(['/admin']);
  }

  clearCache() {
    if (confirm('This deletes your liked songs, playlists, followed artists, history and settings on this device (My Songs are kept). Tip: export a backup from Library first. Continue?')) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
