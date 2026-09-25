import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment, hasSupabase } from '../environment';
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
    // Without a configured project we still create a client so the admin pages
    // load; sign-in just fails with a clear message.
    this.supabase = hasSupabase()
      ? createClient(environment.supabase.url, environment.supabase.key)
      : createClient('https://not-configured.supabase.co', 'not-configured');
    
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

  readonly configured = hasSupabase();

  async signIn(email: string, password: string) {
    if (!this.configured) {
      return { data: { user: null, session: null }, error: new Error('Uploads are off: add your Supabase URL and anon key in src/app/core/environment.ts') } as const;
    }
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    return this.supabase.auth.signOut();
  }

  getUser() {
    return this.currentUser.value;
  }
}
