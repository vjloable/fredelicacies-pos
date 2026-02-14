// Auth Repository - Handles authentication data access
import { supabase } from '@/lib/supabase';
import type { User, SignUpData, SignInData, AuthSession } from '@/types/domain/auth';

export const authRepository = {
  // Sign up new user
  async signUp(data: SignUpData): Promise<{ user: User | null; error: any }> {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) return { user: null, error };
    
    const user: User | null = authData.user ? {
      id: authData.user.id,
      email: authData.user.email!,
      created_at: authData.user.created_at,
    } : null;

    return { user, error: null };
  },

  // Sign in user
  async signIn(data: SignInData): Promise<{ session: AuthSession | null; error: any }> {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) return { session: null, error };

    const session: AuthSession | null = authData.session ? {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        created_at: authData.user.created_at,
      },
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    } : null;

    return { session, error: null };
  },

  // Sign out
  async signOut(): Promise<{ error: any }> {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current user
  async getCurrentUser(): Promise<{ user: User | null; error: any }> {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) return { user: null, error };

    const user: User | null = data.user ? {
      id: data.user.id,
      email: data.user.email!,
      created_at: data.user.created_at,
    } : null;

    return { user, error: null };
  },

  // Get current session
  async getSession(): Promise<{ session: AuthSession | null; error: any }> {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) return { session: null, error };

    const session: AuthSession | null = data.session ? {
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
        created_at: data.session.user.created_at,
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    } : null;

    return { session, error: null };
  },

  // Subscribe to auth state changes
  onAuthStateChange(callback: (session: AuthSession | null) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const authSession: AuthSession | null = session ? {
          user: {
            id: session.user.id,
            email: session.user.email!,
            created_at: session.user.created_at,
          },
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        } : null;

        callback(authSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  },
};
