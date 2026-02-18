-- Noonan Hockey — Supabase Schema (Quick Setup)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
--
-- For the full, idempotent migration with triggers, see:
--   src/supabase/migrations/001_user_settings_rls.sql
--
-- Architecture: All access goes through API routes using SUPABASE_SERVICE_ROLE_KEY.
-- RLS policies deny all direct anon/authenticated access as defence-in-depth.

-- User settings (synced across devices)
CREATE TABLE IF NOT EXISTS user_settings (
  user_email TEXT PRIMARY KEY,
  user_name TEXT DEFAULT '',
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies if they exist
DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Allow all" ON user_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_settings;

-- Deny all direct access from anon and authenticated roles.
-- The service_role key (used by API routes) bypasses RLS automatically.
CREATE POLICY "deny_select" ON user_settings FOR SELECT TO anon, authenticated USING ((1 = 0));
CREATE POLICY "deny_insert" ON user_settings FOR INSERT TO anon, authenticated WITH CHECK ((1 = 0));
CREATE POLICY "deny_update" ON user_settings FOR UPDATE TO anon, authenticated USING ((1 = 0)) WITH CHECK ((1 = 0));
CREATE POLICY "deny_delete" ON user_settings FOR DELETE TO anon, authenticated USING ((1 = 0));

-- Revoke direct table access; grant only to service_role
REVOKE ALL ON user_settings FROM anon;
REVOKE ALL ON user_settings FROM authenticated;
GRANT ALL ON user_settings TO service_role;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated ON user_settings(updated_at);
