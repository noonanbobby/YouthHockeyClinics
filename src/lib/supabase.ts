import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client using the public anon key (safe for client-side use).
 * Returns null if environment variables are not configured.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? (() => {
        if (!_client) {
          _client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          });
        }
        return _client;
      })()
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
