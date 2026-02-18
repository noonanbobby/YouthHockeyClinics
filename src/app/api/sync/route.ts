import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { encryptSettingsCredentials, decryptSettingsCredentials } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!key && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(
        '[sync] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
          'Refusing to use the anon key for server-side data operations.',
      );
    } else {
      console.warn('[sync] Supabase not configured — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
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

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated', synced: false }, { status: 401 });
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Sync not configured — SUPABASE_SERVICE_ROLE_KEY missing', synced: false },
        { status: 503 },
      );
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings, updated_at')
      .eq('user_email', session.user.email)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[sync] Supabase fetch error:', error.message, error.code);
      return NextResponse.json(
        { error: 'Fetch failed', detail: error.message, synced: false },
        { status: 500 },
      );
    }

    let settings = data?.settings || null;
    if (settings && typeof settings === 'object') {
      try {
        settings = await decryptSettingsCredentials(settings as Record<string, unknown>);
      } catch (decryptErr) {
        console.error('[sync] Decrypt error:', decryptErr);
        // Return settings as-is rather than failing the whole request
      }
    }

    return NextResponse.json({
      settings,
      updatedAt: data?.updated_at || null,
      synced: true,
    });
  } catch (err) {
    console.error('[sync] GET unhandled error:', err);
    return NextResponse.json({ error: 'Internal error', synced: false }, { status: 500 });
  }
}

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

    let body: { settings?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    let encryptedSettings: Record<string, unknown>;
    try {
      encryptedSettings = await encryptSettingsCredentials(
        settings as Record<string, unknown>,
      );
    } catch (encErr) {
      console.error('[sync] Encrypt error:', encErr);
      return NextResponse.json({ error: 'Encryption failed' }, { status: 500 });
    }

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
      console.error('[sync] Supabase upsert error:', error.message, error.code);
      return NextResponse.json(
        { error: 'Save failed', detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[sync] PUT unhandled error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
