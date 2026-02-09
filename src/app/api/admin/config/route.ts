import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import SEED_CLINICS from '@/lib/seedClinics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(session as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Return server configuration status (not actual values — just booleans)
  return NextResponse.json({
    auth: {
      googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      appleOAuth: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
      nextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL || 'not set',
    },
    search: {
      googleApi: !!process.env.GOOGLE_API_KEY,
      googleCse: !!process.env.GOOGLE_CSE_ID,
      brave: !!process.env.BRAVE_API_KEY,
      tavily: !!process.env.TAVILY_API_KEY,
      eventbrite: !!process.env.EVENTBRITE_API_KEY,
    },
    app: {
      seedClinics: SEED_CLINICS.length,
      adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean).length,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || 'local',
    },
    user: {
      email: session?.user?.email ?? null,
      name: session?.user?.name ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isAdmin: (session as any)?.isAdmin ?? false,
    },
  });
}
