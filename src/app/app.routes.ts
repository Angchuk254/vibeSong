import { Routes } from '@angular/router';
import { LayoutComponent } from './layouts';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent)
      },
      {
        path: 'library',
        loadComponent: () => import('./pages/library/library.component').then(m => m.LibraryComponent)
      },
      {
        path: 'favorites',
        redirectTo: 'library' // Library defaults to favorites tab
      },
      {
        path: 'category/:id',
        loadComponent: () => import('./pages/category/category.component').then(m => m.CategoryComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
      }
    ]
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/login/admin-login.component').then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin/upload',
    loadComponent: () => import('./pages/admin/upload/admin-upload.component').then(m => m.AdminUploadComponent)
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./pages/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'admin',
    redirectTo: 'admin/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
