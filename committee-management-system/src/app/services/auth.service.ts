import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { signal } from '@angular/core';
import { AuthSession } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabaseService = inject(SupabaseService);
  private supabase = this.supabaseService.getClient();
  currentUser = signal<AuthSession | null>(null);
  isLoading = signal(true);

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      this.currentUser.set(data.session);
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      this.isLoading.set(false);
    }

    // Listen for auth changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser.set(session);
    });
  }

  async signUp(email: string, password: string, fullName: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (error) throw error;

      // Create user profile
      if (data.user) {
        await this.createUserProfile(data.user.id, email, fullName);
      }

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error };
    }
  }

  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign in error:', error);
      const err: any = error || {};
      const message = err.message || err.error || JSON.stringify(err);
      const code = err.code || err.name || null;
      return { success: false, error: { message, code } };
    }
  }

  async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      this.currentUser.set(null);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error };
    }
  }

  private async createUserProfile(userId: string, email: string, fullName: string) {
    try {
      const { error } = await this.supabase
        .from('users')
        .insert([
          {
            id: userId,
            email,
            full_name: fullName,
            reputation_score: 0,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
    } catch (error) {
      console.error('Create user profile error:', error);
      // If public.users table doesn't exist on the project, try inserting into `profiles` as a fallback
      const err: any = error || {};
      const msg = err.message || '';
      if (msg.includes("Could not find the table 'public.users'") || err.code === 'PGRST205') {
        try {
          const { error: err2 } = await this.supabase.from('profiles').insert([
            {
              id: userId,
              email,
              full_name: fullName,
              reputation_score: 0,
              created_at: new Date().toISOString()
            }
          ]);

          if (err2) console.error('Fallback insert into profiles failed:', err2);
        } catch (e) {
          console.error('Fallback create profile error:', e);
        }
      }
    }
  }

  getCurrentUser() {
    return this.currentUser();
  }
}
