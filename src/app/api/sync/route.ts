import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  encryptSettingsCredentials,
  decryptSettingsCredentials,
} from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * Supabase admin client — SERVICE ROLE KEY only.
 * Never exposed to the browser. Bypasses RLS entirely.
 *
 * Required table + RLS (run once in Supabase SQL editor):
 *
 *   CREATE TABLE IF NOT EXISTS user_settings (
 *     user_email  TEXT PRIMARY KEY,
 *     user_name   TEXT,
 *     settings    JSONB,
 *     updated_at  TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Deny anon access" ON user_settings
 *     FOR ALL TO anon USING (false);
 *   CREATE POLICY "Deny authenticated access" ON user_settings
 *     FOR ALL TO authenticated USING (false);
 */
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!key && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(
        '[sync] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
          'Refusing to use the anon key for server-side data operations.',
      );
    }
    return null;
  }

  _supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _supabase;
}

// ── GET ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Sync not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 503 },
      );
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings, updated_at')
      .eq('user_email', session.user.email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }

    let settings = data?.settings || null;
    if (settings && typeof settings === 'object') {
      settings = await decryptSettingsCredentials(
        settings as Record<string, unknown>,
      );
    }

    return NextResponse.json({
      settings,
      updatedAt: data?.updated_at || null,
      synced: true,
    });
  } catch (err) {
    console.error('Sync GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Sync not configured — SUPABASE_SERVICE_ROLE_KEY missing' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'No settings provided' },
        { status: 400 },
      );
    }

    const encryptedSettings = await encryptSettingsCredentials(
      settings as Record<string, unknown>,
    );

    const { error } = await supabase.from('user_settings').upsert(
      {
        user_email: session.user.email,
        user_name: session.user.name || '',
        settings: encryptedSettings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' },
    );

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: 'Save failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Sync PUT error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
