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
 *
 * ── Required Supabase RLS setup ──────────────────────────────────────
 * Run the following SQL in your Supabase SQL editor to lock down the
 * user_settings table so only the service role can access it:
 *
 *   -- Enable RLS
 *   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
 *
 *   -- Drop any existing permissive policies
 *   DROP POLICY IF EXISTS "Allow all" ON user_settings;
 *   DROP POLICY IF EXISTS "Enable read access for all users" ON user_settings;
 *
 *   -- Deny all access from anon and authenticated roles
 *   -- (service_role bypasses RLS entirely, so no policy needed for it)
 *   CREATE POLICY "Deny anon access" ON user_settings
 *     FOR ALL TO anon USING (false);
 *
 *   CREATE POLICY "Deny authenticated access" ON user_settings
 *     FOR ALL TO authenticated USING (false);
 *
 * After applying these policies:
 * - The anon key (used here) cannot read or write user_settings
 * - The authenticated role cannot read or write user_settings
 * - Only the service_role key (used in /api/sync) can access the table
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
