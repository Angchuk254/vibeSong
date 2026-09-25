import { Component, inject } from '@angular/core';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'app-update-banner',
  standalone: true,
  template: `
    @if (updates.updateReady()) {
      <div class="update" role="status">
        <i class="bi bi-stars"></i>
        <span>A new version of vibeOnly is ready</span>
        <button (click)="updates.applyUpdate()">Update</button>
      </div>
    }
  `,
  styles: [`
    .update {
      position: fixed;
      top: calc(12px + env(safe-area-inset-top, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 5000;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: calc(100vw - 24px);
      padding: 8px 8px 8px 16px;
      border-radius: var(--vo-radius-xl);
      background: var(--vo-bg-card);
      border: 1px solid var(--vo-accent);
      box-shadow: var(--vo-shadow-lg);
      color: var(--vo-text-primary);
      font-size: 0.85rem;

      i { color: var(--vo-accent-light); }

      button {
        border: none;
        border-radius: var(--vo-radius-xl);
        padding: 6px 14px;
        background: var(--vo-accent);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
    }
  `],
})
export class UpdateBannerComponent {
  readonly updates = inject(UpdateService);
}
