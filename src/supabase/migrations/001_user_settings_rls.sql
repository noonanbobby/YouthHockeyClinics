-- ══════════════════════════════════════════════════════════════════════
-- Noonan Hockey — user_settings table + Row Level Security
-- ══════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- This script is idempotent — safe to run multiple times.
--
-- Architecture note:
--   All data access goes through Next.js API routes that use the
--   SUPABASE_SERVICE_ROLE_KEY.  The service role bypasses RLS
--   automatically in Supabase, so the policies below are
--   defence-in-depth only — they block any direct anon/authenticated
--   access that bypasses the API layer.
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
DROP POLICY IF EXISTS "service_role_all"              ON public.user_settings;
DROP POLICY IF EXISTS "deny_select"                   ON public.user_settings;
DROP POLICY IF EXISTS "deny_insert"                   ON public.user_settings;
DROP POLICY IF EXISTS "deny_update"                   ON public.user_settings;
DROP POLICY IF EXISTS "deny_delete"                   ON public.user_settings;
DROP POLICY IF EXISTS "Users can read own settings"   ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- ── 4. Deny-all policies for anon and authenticated roles ─────────────
-- Split into one policy per operation to avoid WITH CHECK conflicts on
-- FOR ALL policies. The service role bypasses RLS automatically and is
-- unaffected by these policies.

CREATE POLICY "deny_select"
  ON public.user_settings
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "deny_insert"
  ON public.user_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "deny_update"
  ON public.user_settings
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny_delete"
  ON public.user_settings
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- ── 5. Revoke direct table access from anon and authenticated roles ───
-- Belt-and-suspenders: even if RLS is somehow disabled, these roles
-- have no table-level privileges.
REVOKE ALL ON public.user_settings FROM anon;
REVOKE ALL ON public.user_settings FROM authenticated;
GRANT  ALL ON public.user_settings TO service_role;

-- ── 6. Performance index ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_settings_email
  ON public.user_settings (user_email);

-- ── 7. Auto-update updated_at trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
