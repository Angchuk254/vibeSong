// ============================================
// YakBeats — Main Layout Component
// ============================================

import { Component, inject } from '@angular/core';
import { ShortcutService } from '../../services/shortcut.service';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { PlayerComponent } from '../../player/player.component';
import { PlaylistPickerComponent } from '../../shared/playlist-picker/playlist-picker.component';
import { VideoDockComponent } from '../../player/video-dock/video-dock.component';
import { UpdateBannerComponent } from '../update-banner/update-banner.component';
import { CarModeComponent } from '../../shared/car-mode/car-mode.component';
import { AlarmComponent } from '../../shared/alarm/alarm.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent, PlayerComponent, PlaylistPickerComponent, VideoDockComponent, UpdateBannerComponent, CarModeComponent, AlarmComponent],
  template: `
    <div class="layout">
      <app-sidebar></app-sidebar>

      <main class="layout__main vo-main-content">
        <div class="layout__content">
          <router-outlet></router-outlet>
        </div>
      </main>

      <app-player></app-player>
      <app-bottom-nav></app-bottom-nav>
      <app-playlist-picker></app-playlist-picker>
      <app-video-dock></app-video-dock>
      <app-update-banner></app-update-banner>
      <app-car-mode></app-car-mode>
      <app-alarm></app-alarm>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--vo-bg-primary);
    }

    .layout__main {
      flex: 1;
      min-width: 0;
      position: relative;
    }

    .layout__content {
      padding: 20px 16px;
      /* Room for the notch / status-bar area when the app runs full screen */
      padding-top: calc(20px + env(safe-area-inset-top, 0px));
      padding-left: calc(16px + env(safe-area-inset-left, 0px));
      padding-right: calc(16px + env(safe-area-inset-right, 0px));
      /* Keep the last row clear of the mini player + bottom nav */
      padding-bottom: calc(var(--vo-safe-bottom) + env(safe-area-inset-bottom, 0px) + 16px);
      max-width: 1200px;
      margin: 0 auto;
    }

    @media (min-width: 769px) {
      .layout__main {
        margin-left: 240px; /* Width of sidebar */
      }

      .layout__content {
        padding: 32px 40px;
      }
    }
  `],
})
export class LayoutComponent {
  constructor() {
    inject(ShortcutService).init();
  }
}
