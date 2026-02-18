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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname  = 'user_settings'
      AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- ── 3. Drop existing policies (idempotent) ────────────────────────────
DO $$
DECLARE
  pol TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_settings', pol);
  END LOOP;
END;
$$;

-- ── 4. Deny-all policies for anon and authenticated roles ─────────────
-- Split into one policy per operation to avoid WITH CHECK conflicts on
-- FOR ALL policies. The service role bypasses RLS automatically and is
-- unaffected by these policies.
-- Note: (1=0) is used instead of (false) for linter compatibility —
-- both are semantically identical in Postgres policy expressions.

CREATE POLICY "deny_select"
  ON public.user_settings
  FOR SELECT
  TO anon, authenticated
  USING ((1 = 0));

CREATE POLICY "deny_insert"
  ON public.user_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK ((1 = 0));

CREATE POLICY "deny_update"
  ON public.user_settings
  FOR UPDATE
  TO anon, authenticated
  USING ((1 = 0))
  WITH CHECK ((1 = 0));

CREATE POLICY "deny_delete"
  ON public.user_settings
  FOR DELETE
  TO anon, authenticated
  USING ((1 = 0));

-- ── 5. Revoke direct table access from anon and authenticated roles ───
-- Belt-and-suspenders: even if RLS is somehow disabled, these roles
-- have no table-level privileges.
REVOKE ALL ON public.user_settings FROM anon;
REVOKE ALL ON public.user_settings FROM authenticated;
GRANT  ALL ON public.user_settings TO service_role;

-- ── 6. Performance index ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_settings_email
  ON public.user_settings (user_email);

-- ── 7. Auto-update updated_at trigger function ────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('search_path', 'public', true);
  SELECT NOW() INTO NEW.updated_at;
  RETURN NEW;
END;
$$;

-- ── 8. Attach trigger (idempotent via DO block) ───────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname  = 'user_settings'
      AND t.tgname   = 'trg_user_settings_updated_at'
  ) THEN
    DROP TRIGGER trg_user_settings_updated_at ON public.user_settings;
  END IF;
END;
$$;

CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
