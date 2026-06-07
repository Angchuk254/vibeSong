import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MusicApiService } from '../../../services/music-api.service';

@Component({
  selector: 'app-admin-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-container">
      <div class="header-actions">
        <div class="title-group">
          <button (click)="goBack()" class="btn-back"><i class="fi fi-rr-arrow-left"></i></button>
          <h1><i class="fi fi-rr-upload"></i> Upload Track</h1>
        </div>
        <button (click)="logout()" class="btn-logout"><i class="fi fi-rr-sign-out-alt"></i> Logout</button>
      </div>

      <div class="upload-card glass-panel">
        <form (ngSubmit)="uploadTrack()" #uploadForm="ngForm" class="upload-form">
          <div class="form-row">
            <div class="form-group">
              <label for="title">Song Title</label>
              <input type="text" id="title" name="title" [(ngModel)]="title" required placeholder="e.g. Shape of You">
            </div>

            <div class="form-group">
              <label for="artist">Artist Name</label>
              <input type="text" id="artist" name="artist" [(ngModel)]="artist" required placeholder="e.g. Ed Sheeran">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="album">Album (Optional)</label>
              <input type="text" id="album" name="album" [(ngModel)]="album" placeholder="e.g. Divide">
            </div>
            
            <div class="form-group">
              <label for="category">Song Type</label>
              <select id="category" name="category" [(ngModel)]="category" class="select-input">
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
            </div>
          </div>

          <div class="form-group full-width">
            <label><i class="bi bi-tags-fill"></i> Select Tags (Moods/Genres)</label>
            <div class="tags-checkbox-grid">
              @for (tag of AVAILABLE_TAGS; track tag) {
                <div class="tag-chip" 
                     [class.active]="selectedTags.has(tag)"
                     (click)="toggleTag(tag)">
                  <i class="bi" [ngClass]="selectedTags.has(tag) ? 'bi-check-circle-fill' : 'bi-circle'"></i>
                  {{ tag }}
                </div>
              }
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="duration">Duration (Seconds)</label>
              <input type="number" id="duration" name="duration" [(ngModel)]="duration" required placeholder="Auto-detected">
            </div>
            <div class="form-group"></div> <!-- Spacer -->
          </div>

          <div class="file-uploads">
            <div class="upload-box" [class.has-file]="audioFile">
              <label for="audioFile">
                <i class="fi fi-rr-music-alt"></i>
                <span>{{ audioFile ? audioFile.name : 'Select Audio File (.mp3, .wav)' }}</span>
              </label>
              <input type="file" id="audioFile" accept="audio/*" (change)="onFileSelect($event, 'audio')" required>
            </div>

            <div class="upload-box" [class.has-file]="coverFile">
              <label for="coverFile">
                <i class="fi fi-rr-picture"></i>
                <span>{{ coverFile ? coverFile.name : 'Select Cover Image (.jpg, .png)' }}</span>
              </label>
              <input type="file" id="coverFile" accept="image/*" (change)="onFileSelect($event, 'cover')" required>
            </div>
          </div>

          <div *ngIf="message" [class]="'alert ' + messageType">
            {{ message }}
          </div>

          <button type="submit" class="btn-primary" [disabled]="!uploadForm.form.valid || !audioFile || !coverFile || isLoading">
            <span *ngIf="!isLoading">Upload & Publish</span>
            <span *ngIf="isLoading" class="loading-spinner"></span>
            <span *ngIf="isLoading" class="loading-text">{{ loadingText }}</span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .admin-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      padding-bottom: 100px;
    }
    .header-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .header-actions h1 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-primary);
      font-size: 1.5rem;
    }
    .btn-logout {
      background: rgba(255, 77, 79, 0.1);
      color: #ff4d4f;
      border: 1px solid rgba(255, 77, 79, 0.2);
      padding: 0.5rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.3s ease;
      font-size: 0.85rem;
    }
    .btn-logout span { display: none; }
    @media (min-width: 480px) {
      .btn-logout span { display: inline; }
      .btn-logout { padding: 0.5rem 1rem; }
    }
    .title-group {
      display: flex;
      align-items: center;
      gap: 0.8rem;
    }
    .btn-back {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: white;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .upload-card {
      background: var(--surface-light);
      border: 1px solid var(--border-color);
      border-radius: 24px;
      padding: 1.5rem;
    }
    @media (min-width: 600px) {
      .upload-card { padding: 2rem; }
    }
    .glass-panel {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .upload-form {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.2rem;
    }
    @media (min-width: 600px) {
      .form-row {
        grid-template-columns: 1fr 1fr;
      }
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    input[type="text"], input[type="number"], .select-input {
      width: 100%;
      padding: 0.8rem 1rem;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      color: var(--text-primary);
      box-sizing: border-box;
      transition: all 0.3s ease;
      font-size: 1rem;
      outline: none;
    }
    .select-input option {
      background: #1a1a3e;
      color: white;
    }
    .file-uploads {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    @media (min-width: 480px) {
      .file-uploads {
        grid-template-columns: 1fr 1fr;
      }
    }
    .upload-box {
      position: relative;
      border: 2px dashed var(--border-color);
      border-radius: 16px;
      padding: 1.5rem 0.8rem;
      text-align: center;
      transition: all 0.3s ease;
      background: rgba(0, 0, 0, 0.1);
    }
    .upload-box label i {
      font-size: 1.5rem;
      margin-bottom: 0.4rem;
    }
    .upload-box label span {
      font-size: 0.8rem;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: white;
      border: none;
      padding: 1rem;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.8rem;
      margin-top: 0.5rem;
    }
    .loading-spinner {
      width: 18px; height: 18px;
    }
    .tags-checkbox-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 8px;
    }

    .tag-chip {
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 50px;
      font-size: 0.85rem;
      color: var(--vo-text-muted);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;

      i { font-size: 0.9rem; opacity: 0.5; }

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }

      &.active {
        background: var(--vo-gradient-accent);
        border-color: transparent;
        color: white;
        box-shadow: 0 4px 15px var(--vo-accent-glow);
        
        i { opacity: 1; }
      }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class AdminUploadComponent implements OnInit {
  title = '';
  artist = '';
  album = '';
  category: string = 'Other';
  tags: string = ''; // Keep as comma-separated string for DB
  duration: number = 0;
  
  AVAILABLE_TAGS = [
    'Chill', 'Sad', 'Party', 'Happy', 'Romantic', 
    'Devotional', 'Mashup', 'Remix', 'Acoustic', 
    'Instrumental', 'Classical', 'Soulful'
  ];

  selectedTags: Set<string> = new Set();

  toggleTag(tag: string) {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
    } else {
      this.selectedTags.add(tag);
    }
    this.tags = Array.from(this.selectedTags).join(',');
  }

  audioFile: File | null = null;
  coverFile: File | null = null;

  isLoading = false;
  loadingText = '';
  message = '';
  messageType: 'success' | 'error' = 'success';

  private authService = inject(AuthService);
  private router = inject(Router);
  private musicApiService = inject(MusicApiService);

  async ngOnInit() {
    // Wait for session restoration
    await this.authService.initialized;
    
    // Check if logged in
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/admin/login']);
    }
  }

  async logout() {
    await this.authService.signOut();
    this.router.navigate(['/admin/login']);
  }

  goBack() {
    this.router.navigate(['/admin/dashboard']);
  }

  onFileSelect(event: any, type: 'audio' | 'cover') {
    const file = event.target.files[0];
    if (file) {
      if (type === 'audio') {
        this.audioFile = file;
        this.detectAudioDuration(file);
      } else {
        this.coverFile = file;
      }
    }
  }

  detectAudioDuration(file: File) {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = objectUrl;
    audio.addEventListener('loadedmetadata', () => {
      // Auto-detect and round to nearest second
      this.duration = Math.round(audio.duration);
      URL.revokeObjectURL(objectUrl);
    });
  }

  async uploadTrack() {
    if (!this.audioFile || !this.coverFile) return;

    this.isLoading = true;
    this.message = '';
    
    try {
      const supabase = this.authService.supabase;
      const timestamp = Date.now();

      // 1. Upload Cover
      this.loadingText = 'Uploading cover image...';
      const coverPath = `artwork/${timestamp}_${this.coverFile.name}`;
      const { error: coverError } = await supabase.storage
        .from('covers')
        .upload(coverPath, this.coverFile);
        
      if (coverError) throw coverError;

      // 2. Upload Audio
      this.loadingText = 'Uploading audio file...';
      const audioPath = `audio/${timestamp}_${this.audioFile.name}`;
      const { error: audioError } = await supabase.storage
        .from('songs')
        .upload(audioPath, this.audioFile);

      if (audioError) throw audioError;

      // 3. Get URLs
      this.loadingText = 'Saving metadata...';
      const imageUrl = supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
      const audioUrl = supabase.storage.from('songs').getPublicUrl(audioPath).data.publicUrl;

      // 4. Save to Database
      const { error: dbError } = await supabase.from('tracks').insert({
        title: this.title,
        artist: this.artist,
        album: this.album || null,
        duration: this.duration,
        category: this.category,
        tags: this.tags,
        audio_url: audioUrl,
        image_url: imageUrl
      });

      if (dbError) throw dbError;

      // Clear the music service cache so the new track appears immediately on the UI
      this.musicApiService.clearCache();

      this.messageType = 'success';
      this.message = 'Track uploaded successfully!';
      
      // Reset form
      this.title = '';
      this.artist = '';
      this.album = '';
      this.duration = 0;
      this.audioFile = null;
      this.coverFile = null;

    } catch (error: any) {
      console.error(error);
      this.messageType = 'error';
      this.message = error.message || 'An error occurred during upload';
    } finally {
      this.isLoading = false;
      this.loadingText = '';
    }
  }
}
