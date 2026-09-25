// ============================================
// YakBeats — Share the app (QR code + link)
// ============================================
// The QR code is generated on-device (qrcode-generator), so it works offline
// and doesn't depend on any external service.

import { Component, OnInit, signal } from '@angular/core';
import { notify } from '../../services/storage.service';

@Component({
  selector: 'app-share-card',
  standalone: true,
  template: `
    <div class="share">
      <div class="share__qr" aria-label="QR code for the YakBeats link">
        @if (path()) {
          <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" shape-rendering="crispEdges" role="img">
            <title>Scan to open YakBeats</title>
            <rect [attr.width]="size()" [attr.height]="size()" fill="#fff" />
            <path [attr.d]="path()" fill="#0a0a1a" />
          </svg>
        } @else {
          <div class="share__qr-loading"><i class="bi bi-qr-code"></i></div>
        }
      </div>

      <div class="share__info">
        <h3>Scan to vibe together</h3>
        <p>Point any phone camera at the code to open YakBeats — free, no ads, no login.</p>
        <code class="share__url">{{ displayUrl }}</code>
        <div class="share__actions">
          @if (canShare) {
            <button class="vo-btn vo-btn-primary" (click)="share()"><i class="bi bi-share-fill"></i> Share</button>
          }
          <button class="vo-btn vo-btn-ghost" (click)="copy()"><i class="bi" [class.bi-clipboard]="!copied()" [class.bi-clipboard-check]="copied()"></i> {{ copied() ? 'Copied!' : 'Copy link' }}</button>
          <button class="vo-btn vo-btn-ghost" (click)="download()" [disabled]="!path()"><i class="bi bi-download"></i> Save QR</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .share {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 18px;
    }

    .share__qr {
      flex-shrink: 0;
      width: 168px;
      height: 168px;
      padding: 10px;
      border-radius: var(--vo-radius-md);
      background: #fff;
      box-shadow: var(--vo-shadow-md);

      svg { width: 100%; height: 100%; display: block; }
    }

    .share__qr-loading {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-size: 3rem;
    }

    .share__info {
      min-width: 0;
      flex: 1;

      h3 { margin: 0 0 4px; font-size: 1.05rem; font-weight: 700; }
      p { margin: 0 0 10px; font-size: 0.85rem; color: var(--vo-text-secondary); line-height: 1.5; }
    }

    .share__url {
      display: block;
      margin-bottom: 12px;
      padding: 6px 10px;
      border-radius: var(--vo-radius-sm);
      background: var(--vo-bg-input);
      color: var(--vo-accent-light);
      font-size: 0.78rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .share__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .vo-btn { padding: 8px 14px; font-size: 0.82rem; }
      .vo-btn:disabled { opacity: 0.5; }
    }

    @media (max-width: 576px) {
      .share { flex-direction: column; text-align: center; }
      .share__qr { width: 200px; height: 200px; }
      .share__actions { justify-content: center; }
    }
  `],
})
export class ShareCardComponent implements OnInit {
  /** The app's public link, e.g. https://angchuk254.github.io/vibeSong/ */
  readonly url = document.baseURI;
  readonly displayUrl = this.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  readonly path = signal('');
  readonly size = signal(0);
  readonly copied = signal(false);
  private modules: boolean[][] = [];

  async ngOnInit(): Promise<void> {
    // Loaded on demand so the QR library isn't part of the main bundle
    const mod: any = await import('qrcode-generator');
    const qrcode = mod.default || mod;
    const qr = qrcode(0, 'M');
    qr.addData(this.url);
    qr.make();

    const n = qr.getModuleCount();
    const quiet = 2; // white border so scanners find the edges
    this.modules = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
    let d = '';
    this.modules.forEach((row, r) =>
      row.forEach((dark, c) => {
        if (dark) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
      })
    );
    this.size.set(n + quiet * 2);
    this.path.set(d);
  }

  async share(): Promise<void> {
    try {
      await navigator.share({
        title: 'YakBeats',
        text: 'YakBeats 🐃🎧 — free, ad-free music with no login: full songs, Himalayan radio, lyrics and more',
        url: this.url,
      });
    } catch {
      /* user cancelled */
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url);
    } catch {
      // Older browsers: fall back to a hidden text field
      const t = document.createElement('textarea');
      t.value = this.url;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    this.copied.set(true);
    notify('Link copied — paste it anywhere to share');
    setTimeout(() => this.copied.set(false), 2500);
  }

  /** Saves a PNG with the QR code and the app name, ready to post or print */
  download(): void {
    if (!this.modules.length) return;
    const n = this.modules.length;
    const cell = 12;
    const pad = 48;
    const qrSize = n * cell;
    const canvas = document.createElement('canvas');
    canvas.width = qrSize + pad * 2;
    canvas.height = qrSize + pad * 2 + 90;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0a1a';
    this.modules.forEach((row, r) =>
      row.forEach((dark, c) => dark && ctx.fillRect(pad + c * cell, pad + r * cell, cell, cell))
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6C5CE7';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('YakBeats', canvas.width / 2, qrSize + pad + 50);
    ctx.fillStyle = '#555';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(this.displayUrl, canvas.width / 2, qrSize + pad + 80);

    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'yakbeats-qr.png';
    a.click();
  }
}
