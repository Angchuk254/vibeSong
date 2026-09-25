// ============================================
// vibeOnly — Main Layout Component
// ============================================

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { PlayerComponent } from '../../player/player.component';
import { PlaylistPickerComponent } from '../../shared/playlist-picker/playlist-picker.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, BottomNavComponent, PlayerComponent, PlaylistPickerComponent],
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
export class LayoutComponent {}
