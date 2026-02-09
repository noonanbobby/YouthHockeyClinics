import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function redact(val: string | undefined): string {
  if (!val) return '(not set)';
  if (val.length <= 6) return `"${val[0]}..${val[val.length - 1]}" (${val.length} chars)`;
  return `"${val.substring(0, 3)}...${val.substring(val.length - 3)}" (${val.length} chars)`;
}

function isUrl(val: string | undefined): boolean {
  if (!val) return false;
  try { new URL(val); return true; } catch { return false; }
}

export async function GET() {
  const envVars = {
    AUTH_URL: {
      exists: !!process.env.AUTH_URL,
      isValidUrl: isUrl(process.env.AUTH_URL),
      redacted: redact(process.env.AUTH_URL),
    },
    NEXTAUTH_URL: {
      exists: !!process.env.NEXTAUTH_URL,
      isValidUrl: isUrl(process.env.NEXTAUTH_URL),
      redacted: redact(process.env.NEXTAUTH_URL),
    },
    AUTH_SECRET: {
      exists: !!process.env.AUTH_SECRET,
      isValidUrl: isUrl(process.env.AUTH_SECRET),
      redacted: redact(process.env.AUTH_SECRET),
    },
    NEXTAUTH_SECRET: {
      exists: !!process.env.NEXTAUTH_SECRET,
      isValidUrl: isUrl(process.env.NEXTAUTH_SECRET),
      redacted: redact(process.env.NEXTAUTH_SECRET),
    },
    GOOGLE_CLIENT_ID: {
      exists: !!process.env.GOOGLE_CLIENT_ID,
      redacted: redact(process.env.GOOGLE_CLIENT_ID),
    },
    GOOGLE_CLIENT_SECRET: {
      exists: !!process.env.GOOGLE_CLIENT_SECRET,
      redacted: redact(process.env.GOOGLE_CLIENT_SECRET),
    },
    ADMIN_EMAILS: {
      exists: !!process.env.ADMIN_EMAILS,
      redacted: redact(process.env.ADMIN_EMAILS),
    },
    VERCEL: {
      exists: !!process.env.VERCEL,
      value: process.env.VERCEL,
    },
    VERCEL_URL: {
      exists: !!process.env.VERCEL_URL,
      redacted: redact(process.env.VERCEL_URL),
    },
    NODE_ENV: {
      value: process.env.NODE_ENV,
    },
  };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    diagnosis: envVars,
    notes: [
      'AUTH_URL and NEXTAUTH_URL must be valid URLs (e.g. https://youth-hockey-clinics.vercel.app)',
      'AUTH_SECRET and NEXTAUTH_SECRET must NOT be URLs — they are encryption keys',
      'If AUTH_URL.isValidUrl is false but exists is true, the value is wrong',
      'If AUTH_SECRET.isValidUrl is true, the secret and URL values might be swapped',
    ],
  });
}
