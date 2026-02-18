/**
 * Client-side Supabase instance — uses the PUBLIC anon key.
 *
 * ⚠️  IMPORTANT SECURITY NOTE ⚠️
 * This client uses the anon key and is safe to use in the browser for
 * public data only.  It must NEVER be used to read or write user_settings
 * or any other user-specific data.
 *
 * All user data operations (read/write user_settings) go through the
 * Next.js API route at /api/sync which uses the SUPABASE_SERVICE_ROLE_KEY
 * server-side.  The service role key is never exposed to the client.
 *
 * The RLS policies on user_settings deny all access from the anon and
 * authenticated roles, so even if this client were accidentally used for
 * user data it would be blocked at the database level.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          // We use NextAuth for authentication — disable Supabase auth
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
