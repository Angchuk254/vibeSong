import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  public supabase: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  public user$ = this.currentUser.asObservable();

  public initialized: Promise<boolean>;

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.key);
    
    // Check initial session and resolve the initialized promise
    this.initialized = this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.currentUser.next(session?.user ?? null);
      return true;
    });

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser.next(session?.user ?? null);
    });
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  getUser() {
    return this.currentUser.value;
  }
}
