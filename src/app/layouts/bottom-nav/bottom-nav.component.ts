// ============================================
// YakBeats — Bottom Navigation Component
// ============================================

import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav" id="bottom-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="bottom-nav__item">
        <i class="bi bi-house-fill"></i>
        <span>Home</span>
      </a>
      <a routerLink="/search" routerLinkActive="active" class="bottom-nav__item">
        <i class="bi bi-search"></i>
        <span>Search</span>
      </a>
      <a routerLink="/library" routerLinkActive="active" class="bottom-nav__item">
        <i class="bi bi-collection-fill"></i>
        <span>Library</span>
      </a>
      <a routerLink="/settings" routerLinkActive="active" class="bottom-nav__item">
        <i class="bi bi-gear-fill"></i>
        <span>Settings</span>
      </a>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      /* Extra room for the iPhone home bar */
      height: calc(var(--vo-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
      background: var(--vo-bg-player);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-top: 1px solid var(--vo-border);
      display: flex;
      align-items: center;
      justify-content: space-around;
      z-index: 1000;
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .bottom-nav__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      color: var(--vo-text-muted);
      text-decoration: none;
      font-size: 0.68rem;
      font-weight: 500;
      transition: all var(--vo-transition-fast);
      padding: 6px 16px;
      border-radius: var(--vo-radius-md);

      i {
        font-size: 1.25rem;
        transition: transform var(--vo-transition-fast);
      }

      &:hover {
        color: var(--vo-text-secondary);
      }

      &.active {
        color: var(--vo-accent-light);

        i {
          transform: scale(1.1);
        }
      }
    }

    @media (min-width: 769px) {
      .bottom-nav {
        display: none;
      }
    }
  `],
})
export class BottomNavComponent {}
