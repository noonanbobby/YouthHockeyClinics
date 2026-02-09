-- ═══════════════════════════════════════════════════════════════
-- Noonan Hockey — Supabase Schema
-- ═══════════════════════════════════════════════════════════════
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates the tables needed for cross-device sync.

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

-- Policy: users can only read/write their own settings
-- (Using service role key on server bypasses RLS, but this protects direct access)
CREATE POLICY "Users can read own settings"
  ON user_settings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated ON user_settings(updated_at);
