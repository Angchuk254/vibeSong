import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-box glass-panel">
        <div class="brand-header">
          <i class="fi fi-rr-music-alt"></i>
          <h1>Admin Portal</h1>
        </div>

        <form (ngSubmit)="login()" #loginForm="ngForm" class="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <div class="input-with-icon">
              <i class="fi fi-rr-envelope"></i>
              <input type="email" id="email" name="email" [(ngModel)]="email" required placeholder="admin@example.com">
            </div>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="input-with-icon">
              <i class="fi fi-rr-lock"></i>
              <input type="password" id="password" name="password" [(ngModel)]="password" required placeholder="Enter password">
            </div>
          </div>

          <div *ngIf="errorMessage" class="error-message">
            <i class="fi fi-rr-exclamation"></i> {{ errorMessage }}
          </div>

          <button type="submit" class="btn-primary" [disabled]="!loginForm.form.valid || isLoading">
            <span *ngIf="!isLoading">Login to Dashboard</span>
            <span *ngIf="isLoading" class="loading-spinner"></span>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 90vh;
      padding: 1.5rem;
    }
    .login-box {
      width: 100%;
      max-width: 400px;
      padding: 2rem 1.5rem;
      border-radius: 24px;
      background: var(--surface-light);
      border: 1px solid var(--border-color);
    }
    @media (min-width: 480px) {
      .login-box {
        padding: 3rem;
      }
    }
    .glass-panel {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .brand-header i {
      font-size: 2.5rem;
      color: var(--primary-color);
      margin-bottom: 0.5rem;
      display: inline-block;
      text-shadow: 0 0 20px rgba(138, 43, 226, 0.4);
    }
    .brand-header h1 {
      font-size: 1.5rem;
      margin: 0;
      color: var(--text-primary);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
    .input-with-icon {
      position: relative;
    }
    .input-with-icon i {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }
    input {
      width: 100%;
      padding: 0.9rem 1rem 0.9rem 2.8rem;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      color: var(--text-primary);
      font-size: 1rem;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: var(--primary-color);
      background: rgba(0, 0, 0, 0.3);
      box-shadow: 0 0 0 2px rgba(138, 43, 226, 0.2);
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
      transition: all 0.3s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 0.5rem;
    }
    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(138, 43, 226, 0.4);
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error-message {
      color: #ff4d4f;
      background: rgba(255, 77, 79, 0.1);
      padding: 0.8rem;
      border-radius: 8px;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class AdminLoginComponent implements OnInit {
  email = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  private authService = inject(AuthService);
  private router = inject(Router);

  async ngOnInit() {
    // Wait for Supabase to restore the session from localStorage
    await this.authService.initialized;
    
    // If already logged in, go straight to dashboard
    const user = this.authService.getUser();
    if (user) {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  async login() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      const { error } = await this.authService.signIn(this.email, this.password);
      
      if (error) {
        this.errorMessage = error.message;
      } else {
        this.router.navigate(['/admin/dashboard']);
      }
    } catch (err: any) {
      this.errorMessage = 'An unexpected error occurred';
    } finally {
      this.isLoading = false;
    }
  }
}
