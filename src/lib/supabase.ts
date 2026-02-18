/**
 * Client-side Supabase instance — PUBLIC anon key only.
 *
 * NEVER use this client for user_settings reads/writes.
 * All user data goes through /api/sync (service role key, server-side).
 *
 * Required RLS (run in Supabase SQL editor):
 *
 *   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
 *   DROP POLICY IF EXISTS "Allow all" ON user_settings;
 *   DROP POLICY IF EXISTS "Enable read access for all users" ON user_settings;
 *   CREATE POLICY "Deny anon access" ON user_settings
 *     FOR ALL TO anon USING (false);
 *   CREATE POLICY "Deny authenticated access" ON user_settings
 *     FOR ALL TO authenticated USING (false);
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
