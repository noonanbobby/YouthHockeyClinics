-- ══════════════════════════════════════════════════════════════════════
-- Noonan Hockey — user_settings table + Row Level Security
-- ══════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- This script is idempotent — safe to run multiple times.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Create table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_email  TEXT        PRIMARY KEY,
  user_name   TEXT        NOT NULL DEFAULT '',
  settings    JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Enable Row Level Security ──────────────────────────────────────
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- ── 3. Drop existing policies (idempotent) ────────────────────────────
DROP POLICY IF EXISTS "service_role_all"          ON public.user_settings;
DROP POLICY IF EXISTS "Users can read own settings"   ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- ── 4. Service-role bypass policy ────────────────────────────────────
-- Our Next.js API routes use SUPABASE_SERVICE_ROLE_KEY which bypasses
-- RLS automatically in Supabase.  This explicit policy is defence-in-depth
-- for any future anon-key usage.
CREATE POLICY "service_role_all"
  ON public.user_settings
  FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 5. Authenticated user policies ───────────────────────────────────
-- These apply when using Supabase's own auth (not NextAuth).
-- They provide a second layer of defence in case the service role key
-- is ever accidentally used client-side.

CREATE POLICY "Users can read own settings"
  ON public.user_settings
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.email() = user_email
  );

CREATE POLICY "Users can insert own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.email() = user_email
  );

CREATE POLICY "Users can update own settings"
  ON public.user_settings
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR auth.email() = user_email
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.email() = user_email
  );

CREATE POLICY "Users can delete own settings"
  ON public.user_settings
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR auth.email() = user_email
  );

-- ── 6. Revoke direct table access from anon and authenticated roles ───
-- Our API exclusively uses the service_role key.
-- Anon users should never be able to touch this table directly.
REVOKE ALL ON public.user_settings FROM anon;
REVOKE ALL ON public.user_settings FROM authenticated;
GRANT  ALL ON public.user_settings TO service_role;

-- ── 7. Performance index ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_settings_email
  ON public.user_settings (user_email);

-- ── 8. updated_at auto-update trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
