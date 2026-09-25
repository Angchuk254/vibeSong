// ============================================
// vibeOnly — Sidebar Navigation (Desktop)
// ============================================

import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService, LibraryService } from '../../services';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="sidebar__brand">
        <div class="sidebar__logo">
          <i class="bi bi-soundwave"></i>
        </div>
        <h1 class="sidebar__title">vibe<span>Only</span></h1>
      </div>

      <nav class="sidebar__nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="sidebar__link">
          <i class="bi bi-house-fill"></i>
          <span>Home</span>
        </a>
        <a routerLink="/search" routerLinkActive="active" class="sidebar__link">
          <i class="bi bi-search"></i>
          <span>Search</span>
        </a>
        <a routerLink="/library" routerLinkActive="active" class="sidebar__link">
          <i class="bi bi-collection-fill"></i>
          <span>Library</span>
        </a>
        <a routerLink="/library" [queryParams]="{ tab: 'liked' }" class="sidebar__link">
          <i class="bi bi-heart-fill"></i>
          <span>Liked Songs</span>
        </a>
      </nav>

      <div class="sidebar__playlists">
        <div class="sidebar__section-head">
          <span>Playlists</span>
          <a routerLink="/library" [queryParams]="{ tab: 'playlists' }" aria-label="Manage playlists"><i class="bi bi-plus-lg"></i></a>
        </div>
        @for (pl of library.playlists(); track pl.id) {
          <a class="sidebar__playlist" [routerLink]="['/playlist', pl.id]" routerLinkActive="active">
            <i class="bi bi-music-note-list"></i>
            <span>{{ pl.name }}</span>
          </a>
        } @empty {
          <p class="sidebar__muted">No playlists yet</p>
        }
      </div>

      <div class="sidebar__footer">
        <button class="sidebar__theme-btn" (click)="theme.toggleTheme()">
          <i class="bi" [class.bi-moon-fill]="theme.isDark()" [class.bi-sun-fill]="!theme.isDark()"></i>
          <span>{{ theme.isDark() ? 'Dark' : 'Light' }} Mode</span>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 240px;
      background: var(--vo-bg-secondary);
      border-right: 1px solid var(--vo-border);
      display: flex;
      flex-direction: column;
      z-index: 1100;
      padding: 24px 16px;
    }

    .sidebar__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 36px;
      padding: 0 8px;
    }

    .sidebar__logo {
      width: 40px;
      height: 40px;
      border-radius: var(--vo-radius-md);
      background: var(--vo-gradient-accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      color: #fff;
      box-shadow: var(--vo-shadow-glow);
    }

    .sidebar__title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--vo-text-primary);
      margin: 0;

      span {
        color: var(--vo-accent-light);
      }
    }

    .sidebar__nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sidebar__playlists {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--vo-border);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sidebar__section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px 8px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--vo-text-muted);

      a {
        color: var(--vo-text-secondary);
        font-size: 0.9rem;

        &:hover { color: var(--vo-text-primary); }
      }
    }

    .sidebar__playlist {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: var(--vo-radius-sm);
      color: var(--vo-text-secondary);
      text-decoration: none;
      font-size: 0.88rem;

      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &:hover,
      &.active {
        color: var(--vo-text-primary);
        background: var(--vo-bg-input);
      }
    }

    .sidebar__muted {
      padding: 0 12px;
      font-size: 0.82rem;
      color: var(--vo-text-muted);
    }

    .sidebar__link {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: var(--vo-radius-md);
      color: var(--vo-text-secondary);
      text-decoration: none;
      font-size: 0.92rem;
      font-weight: 500;
      transition: all var(--vo-transition-fast);

      i {
        font-size: 1.15rem;
        width: 24px;
        text-align: center;
      }

      &:hover {
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
      }

      &.active {
        background: var(--vo-accent-glow);
        color: var(--vo-accent-light);
        font-weight: 600;
      }
    }

    .sidebar__footer {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--vo-border);
    }

    .sidebar__theme-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      border-radius: var(--vo-radius-md);
      border: none;
      background: transparent;
      color: var(--vo-text-secondary);
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--vo-transition-fast);
      font-family: var(--vo-font-primary);

      i {
        font-size: 1.15rem;
      }

      &:hover {
        background: var(--vo-bg-input);
        color: var(--vo-text-primary);
      }
    }

    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }
    }
  `],
})
export class SidebarComponent {
  readonly theme = inject(ThemeService);
  readonly library = inject(LibraryService);
}
