import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import {
  encryptSettingsCredentials,
  decryptSettingsCredentials,
} from '@/lib/crypto';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ── GET: Load user settings from Supabase ─────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Sync not configured' }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings, updated_at')
      .eq('user_email', session.user.email)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found — not an error for us
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }

    // Decrypt credential fields before returning to the client
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

// ── PUT: Save user settings to Supabase ───────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Sync not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    // Encrypt credential fields before writing to Supabase
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
