import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MusicApiService } from '../../../services/music-api.service';
import { FormsModule } from '@angular/forms';

interface EditableTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  image_url: string;
  audio_url: string;
  duration: number;
  category: string;
  tags: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div class="header-content">
          <h1>Music Management</h1>
          <div class="header-actions">
            <a routerLink="/admin/upload" class="btn-primary">
              <i class="bi bi-plus-lg"></i> Upload New Song
            </a>
            <button (click)="logout()" class="btn-outline">
              <i class="bi bi-box-arrow-right"></i> Logout
            </button>
          </div>
        </div>
      </header>

      <div class="content-area">
        <div class="stats-cards">
          <div class="stat-card glass-panel">
            <span class="stat-label">Total Tracks</span>
            <span class="stat-value">{{ tracks().length }}</span>
          </div>
        </div>

        <div class="tracks-table-container glass-panel">
          <div class="table-header">
            <h2>Uploaded Tracks</h2>
            <div class="search-box">
              <i class="bi bi-search"></i>
              <input type="text" placeholder="Filter tracks..." [(ngModel)]="filterQuery">
            </div>
          </div>

          <div class="table-wrapper">
            <table class="tracks-table">
              <thead>
                <tr>
                  <th>Cover</th>
                  <th>Title</th>
                  <th>Artist</th>
                  <th>Album</th>
                  <th>Type</th>
                  <th>Tags</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (track of filteredTracks(); track track.id) {
                  <tr>
                    <td>
                      <div class="image-edit-container">
                        <img [src]="track.image_url" class="table-img" alt="cover">
                        @if (editingId() === track.id) {
                          <label class="image-upload-label">
                            <i class="bi bi-camera"></i>
                            <input type="file" (change)="onImageSelect($event)" accept="image/*" class="hidden-input">
                          </label>
                        }
                      </div>
                    </td>
                    <td>
                      @if (editingId() === track.id) {
                        <input type="text" [(ngModel)]="editBuffer.title" class="edit-input" placeholder="Title">
                      } @else {
                        {{ track.title }}
                      }
                    </td>
                    <td>
                      @if (editingId() === track.id) {
                        <input type="text" [(ngModel)]="editBuffer.artist" class="edit-input" placeholder="Artist">
                      } @else {
                        {{ track.artist }}
                      }
                    </td>
                    <td>
                      @if (editingId() === track.id) {
                        <input type="text" [(ngModel)]="editBuffer.album" class="edit-input" placeholder="Album">
                      } @else {
                        {{ track.album }}
                      }
                    </td>
                    <td>
                      @if (editingId() === track.id) {
                        <select [(ngModel)]="editBuffer.category" class="edit-input select-edit">
                          <option value="Ladakhi">Ladakhi</option>
                          <option value="Pahadi">Pahadi</option>
                          <option value="Tibetan">Tibetan</option>
                          <option value="Hindi">Hindi</option>
                          <option value="English">English</option>
                          <option value="Punjabi">Punjabi</option>
                          <option value="Folk">Folk</option>
                          <option value="Meditation">Meditation</option>
                          <option value="Chill">Chill</option>
                          <option value="Indie">Indie</option>
                          <option value="Bollywood">Bollywood</option>
                          <option value="International">International</option>
                          <option value="Other">Other</option>
                        </select>
                      } @else {
                        <span class="type-badge">{{ track.category || 'Other' }}</span>
                      }
                    </td>
                    <td>
                      @if (editingId() === track.id) {
                        <div class="edit-tags-grid">
                          @for (tag of AVAILABLE_TAGS; track tag) {
                            <span class="tag-chip-small" 
                                  [class.active]="isTagSelected(tag)"
                                  (click)="toggleEditTag(tag)">
                              {{ tag }}
                            </span>
                          }
                        </div>
                      } @else {
                        <div class="tags-list">
                          @for (tag of (track.tags || '').split(','); track tag) {
                            @if (tag.trim()) {
                              <span class="tag-badge">{{ tag.trim() }}</span>
                            }
                          }
                        </div>
                      }
                    </td>
                    <td>{{ formatDuration(track.duration) }}</td>
                    <td>
                      <div class="actions">
                        @if (editingId() === track.id) {
                          <button (click)="saveEdit(track)" class="btn-icon save" [disabled]="isSaving">
                            <i class="bi bi-check-lg" *ngIf="!isSaving"></i>
                            <span class="spinner" *ngIf="isSaving"></span>
                          </button>
                          <button (click)="cancelEdit()" class="btn-icon cancel">
                            <i class="bi bi-x-lg"></i>
                          </button>
                        } @else {
                          <button (click)="startEdit(track)" class="btn-icon edit">
                            <i class="bi bi-pencil"></i>
                          </button>
                          <button (click)="deleteTrack(track)" class="btn-icon delete">
                            <i class="bi bi-trash"></i>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-row">
                      @if (isLoading()) {
                        <div class="loading-state">
                          <span class="spinner"></span> Loading tracks...
                        </div>
                      } @else {
                        No tracks found.
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
      padding-bottom: 100px;
    }
    .dashboard-header {
      margin-bottom: 1.5rem;
    }
    .header-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    @media (min-width: 600px) {
      .header-content {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
      .dashboard-container {
        padding: 2rem;
      }
    }
    .header-actions {
      display: flex;
      gap: 0.5rem;
      width: 100%;
    }
    @media (min-width: 600px) {
      .header-actions {
        width: auto;
        gap: 1rem;
      }
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0;
      background: var(--vo-gradient-accent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    @media (min-width: 600px) {
      h1 { font-size: 2rem; }
    }
    .glass-panel {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.2rem;
    }
    .stats-cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    @media (min-width: 480px) {
      .stats-cards { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .stat-label {
      font-size: 0.8rem;
      color: var(--vo-text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 800;
    }
    .tracks-table-container {
      padding: 0;
      overflow: hidden;
    }
    .table-header {
      padding: 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    @media (min-width: 768px) {
      .table-header {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }
    .search-box {
      position: relative;
      width: 100%;
    }
    @media (min-width: 768px) {
      .search-box { width: 300px; }
    }
    .search-box i {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--vo-text-muted);
    }
    .search-box input {
      width: 100%;
      padding: 0.7rem 1rem 0.7rem 2.8rem;
      background: rgba(0,0,0,0.2);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: white;
      outline: none;
      font-size: 0.9rem;
    }
    .table-wrapper {
      overflow-x: auto;
    }
    .tracks-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    
    /* Responsive Table Styles */
    @media (max-width: 767px) {
      .tracks-table thead { display: none; }
      .tracks-table tr {
        display: grid;
        grid-template-areas: 
          "img title actions"
          "img artist actions"
          "img album actions";
        grid-template-columns: 60px 1fr auto;
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        gap: 0.2rem 1rem;
        align-items: center;
      }
      .tracks-table td { 
        padding: 0 !important; 
        border: none !important;
      }
      .tracks-table td:nth-child(1) { grid-area: img; }
      .tracks-table td:nth-child(2) { grid-area: title; font-weight: 600; color: white; }
      .tracks-table td:nth-child(3) { grid-area: artist; font-size: 0.85rem; color: var(--vo-text-muted); }
      .tracks-table td:nth-child(4) { grid-area: album; font-size: 0.85rem; color: var(--vo-text-muted); }
      .tracks-table td:nth-child(5) { display: none; } /* Hide duration on tiny mobile */
      .tracks-table td:nth-child(6) { grid-area: actions; }
      
      .table-img { width: 56px; height: 56px; }
      .image-edit-container { width: 56px; height: 56px; }
    }

    @media (min-width: 768px) {
      .tracks-table th {
        padding: 1rem 1.5rem;
        font-size: 0.85rem;
        color: var(--vo-text-muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .tracks-table td {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        vertical-align: middle;
      }
    }

    .image-edit-container {
      position: relative;
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }
    .table-img {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      object-fit: cover;
      display: block;
    }
    .image-upload-label {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      color: white;
      font-size: 1.2rem;
    }
    .image-edit-container:hover .image-upload-label {
      opacity: 1;
    }
    .hidden-input {
      display: none;
    }
    .edit-input {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--vo-accent);
      border-radius: 4px;
      color: white;
      padding: 4px 8px;
      width: 100%;
      font-size: 0.9rem;
    }
    .select-edit {
      cursor: pointer;
      background: #1a1a3e;
    }
    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      background: rgba(108, 92, 231, 0.1);
      color: var(--vo-accent-light);
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-width: 200px;
    }
    .tag-badge {
      font-size: 0.7rem;
      padding: 1px 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: var(--vo-text-muted);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      background: rgba(255,255,255,0.05);
      color: var(--vo-text-secondary);
    }
    @media (min-width: 600px) {
      .btn-icon { width: 36px; height: 36px; }
    }
    .btn-icon:hover {
      background: rgba(255,255,255,0.1);
      color: white;
    }
    .btn-icon.delete:hover {
      background: rgba(255, 59, 48, 0.1);
      color: #ff3b30;
    }
    .btn-icon.save {
      background: rgba(52, 199, 89, 0.1);
      color: #34c759;
    }
    .btn-icon.cancel {
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-primary {
      padding: 0.7rem 1.2rem;
      background: var(--vo-gradient-accent);
      border-radius: 10px;
      color: white;
      text-decoration: none;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      flex: 1;
    }
    @media (min-width: 600px) {
      .btn-primary { padding: 0.8rem 1.5rem; flex: none; }
    }
    .btn-outline {
      padding: 0.7rem 1.2rem;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9rem;
    }
    @media (min-width: 600px) {
      .btn-outline { padding: 0.8rem 1.5rem; }
    }
    .empty-row {
      text-align: center;
      padding: 3rem !important;
      color: var(--vo-text-muted);
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }
    .edit-tags-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-width: 320px; /* Wider to allow more tags per row */
      padding: 8px 0;
    }

    .tag-chip-small {
      font-size: 0.7rem;
      padding: 4px 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: pointer;
      color: var(--vo-text-muted);
      transition: all 0.2s;
      white-space: nowrap;

      &.active {
        background: var(--vo-accent);
        color: white;
        border-color: transparent;
        box-shadow: 0 2px 8px var(--vo-accent-glow);
      }

      &:hover:not(.active) {
        background: rgba(255,255,255,0.1);
      }
    }

    /* Overall Table Polishing */
    .dashboard-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0 12px; /* Row spacing */
      
      th {
        padding: 12px 20px;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 1px;
        color: var(--vo-text-muted);
        font-weight: 700;
      }

      tr {
        background: rgba(255,255,255,0.02);
        transition: transform 0.2s;
        
        td {
          padding: 16px 20px;
          border-top: 1px solid rgba(255,255,255,0.03);
          border-bottom: 1px solid rgba(255,255,255,0.03);
          
          &:first-child {
            border-left: 1px solid rgba(255,255,255,0.03);
            border-top-left-radius: 16px;
            border-bottom-left-radius: 16px;
          }
          &:last-child {
            border-right: 1px solid rgba(255,255,255,0.03);
            border-top-right-radius: 16px;
            border-bottom-right-radius: 16px;
          }
        }

        &:hover {
          background: rgba(255,255,255,0.04);
        }

        &.editing {
          background: rgba(108, 92, 231, 0.05);
          border: 1px solid var(--vo-accent);
          
          td {
            border-color: rgba(108, 92, 231, 0.2);
          }
        }
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private musicApi = inject(MusicApiService);
  private router = inject(Router);

  tracks = signal<EditableTrack[]>([]);
  isLoading = signal(true);
  isSaving = false;
  filterQuery = '';
  editingId = signal<string | null>(null);
  editBuffer: Partial<EditableTrack> = {};
  newImageFile: File | null = null;
  
  AVAILABLE_TAGS = [
    'Chill', 'Sad', 'Party', 'Happy', 'Romantic', 
    'Devotional', 'Mashup', 'Remix', 'Acoustic', 
    'Instrumental', 'Classical', 'Soulful'
  ];

  isTagSelected(tag: string): boolean {
    const currentTags = (this.editBuffer.tags || '').split(',');
    return currentTags.includes(tag);
  }

  toggleEditTag(tag: string) {
    let currentTags = (this.editBuffer.tags || '').split(',').filter(t => t.trim().length > 0);
    if (currentTags.includes(tag)) {
      currentTags = currentTags.filter(t => t !== tag);
    } else {
      currentTags.push(tag);
    }
    this.editBuffer.tags = currentTags.join(',');
  }

  async ngOnInit() {
    await this.authService.initialized;
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/admin/login']);
      return;
    }
    await this.loadTracks();
  }

  async loadTracks() {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.authService.supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.tracks.set(data || []);
    } catch (err) {
      console.error('Error loading tracks:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  filteredTracks() {
    if (!this.filterQuery) return this.tracks();
    const query = this.filterQuery.toLowerCase();
    return this.tracks().filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.artist.toLowerCase().includes(query) ||
      t.album.toLowerCase().includes(query) ||
      (t.category && t.category.toLowerCase().includes(query)) ||
      (t.tags && t.tags.toLowerCase().includes(query))
    );
  }

  startEdit(track: EditableTrack) {
    this.editingId.set(track.id);
    this.editBuffer = { ...track };
    this.newImageFile = null;
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editBuffer = {};
    this.newImageFile = null;
  }

  onImageSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.newImageFile = file;
      // Temporary preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.editBuffer.image_url = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async saveEdit(track: EditableTrack) {
    this.isSaving = true;
    try {
      let finalImageUrl = track.image_url;

      // 1. Upload new image if selected
      if (this.newImageFile) {
        const timestamp = Date.now();
        const coverPath = `artwork/${timestamp}_updated_${this.newImageFile.name}`;
        const { error: uploadError } = await this.authService.supabase.storage
          .from('covers')
          .upload(coverPath, this.newImageFile);
          
        if (uploadError) throw uploadError;
        finalImageUrl = this.authService.supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
      }

      // 2. Update DB
      const { error } = await this.authService.supabase
        .from('tracks')
        .update({
          title: this.editBuffer.title,
          artist: this.editBuffer.artist,
          album: this.editBuffer.album,
          category: this.editBuffer.category,
          tags: this.editBuffer.tags,
          image_url: finalImageUrl
        })
        .eq('id', track.id);

      if (error) throw error;
      
      // Clear cache so changes appear on Home/Search
      this.musicApi.clearCache();
      
      // Update local state
      this.tracks.update(list => list.map(t => 
        t.id === track.id ? { ...t, ...this.editBuffer, image_url: finalImageUrl } as EditableTrack : t
      ));
      
      this.cancelEdit();
    } catch (err) {
      console.error('Error saving edit:', err);
      alert('Failed to save changes');
    } finally {
      this.isSaving = false;
    }
  }

  async deleteTrack(track: EditableTrack) {
    if (!confirm(`Are you sure you want to delete "${track.title}"?`)) return;

    try {
      const { error } = await this.authService.supabase
        .from('tracks')
        .delete()
        .eq('id', track.id);

      if (error) throw error;

      this.musicApi.clearCache();
      this.tracks.update(list => list.filter(t => t.id !== track.id));
    } catch (err) {
      console.error('Error deleting track:', err);
      alert('Failed to delete track');
    }
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/admin/login']);
  }
}
