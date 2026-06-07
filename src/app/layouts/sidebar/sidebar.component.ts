// ============================================
// vibeOnly — Sidebar Navigation (Desktop)
// ============================================

import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services';

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
        <a routerLink="/favorites" routerLinkActive="active" class="sidebar__link">
          <i class="bi bi-heart-fill"></i>
          <span>Favorites</span>
        </a>
      </nav>

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
      flex: 1;
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
}
