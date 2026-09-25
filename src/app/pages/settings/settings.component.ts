import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ThemeService, MusicApiService, DeviceMusicService } from '../../services';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
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
  `]
})
export class SettingsComponent {
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly musicApi = inject(MusicApiService);
  readonly device = inject(DeviceMusicService);

  openDevice() {
    this.router.navigate(['/library'], { queryParams: { tab: 'device' } });
  }

  openAdmin() {
    this.router.navigate(['/admin']);
  }

  clearCache() {
    if (confirm('Are you sure you want to clear your favorites and play history?')) {
      localStorage.clear();
      window.location.reload();
    }
  }
}
