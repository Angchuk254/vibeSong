// ============================================
// vibeOnly — Theme Service
// ============================================

import { Injectable, signal, effect, inject } from '@angular/core';
import { ThemeMode } from '../models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private storage = inject(StorageService);
  readonly currentTheme = signal<ThemeMode>('dark');

  constructor() {
    const saved = this.storage.getTheme();
    this.currentTheme.set(saved);
    this.applyTheme(saved);

    // Auto-apply theme when signal changes
    effect(() => {
      this.applyTheme(this.currentTheme());
    });
  }

  toggleTheme(): void {
    const next: ThemeMode =
      this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.currentTheme.set(next);
    this.storage.saveTheme(next);
  }

  isDark(): boolean {
    return this.currentTheme() === 'dark';
  }

  private applyTheme(theme: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', theme);
    // Update PWA theme color meta tag
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        'content',
        theme === 'dark' ? '#0a0a1a' : '#f5f3ff'
      );
    }
  }
}
