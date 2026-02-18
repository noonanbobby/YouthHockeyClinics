import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';

// ─── ENV VAR SANITIZATION ────────────────────────────────────────────────────
// NextAuth v5 reads AUTH_URL and AUTH_SECRET from process.env internally.
// It also falls back to NEXTAUTH_URL and NEXTAUTH_SECRET (v4 compat).
//
// The bug: if AUTH_URL or NEXTAUTH_URL accidentally contains a non-URL value
// (e.g. the secret), NextAuth calls `new URL(secret)` and crashes with
// "TypeError: Invalid URL". This is a FATAL unrecoverable 500.
//
// Defense: validate every URL-related env var. If it's not a valid URL,
// delete it. NextAuth's createActionURL will fall back to reading the
// Host header from the request, which works perfectly on Vercel.
// ─────────────────────────────────────────────────────────────────────────────

function isValidUrl(s: string | undefined): boolean {
  if (!s) return false;
  try { new URL(s); return true; } catch { return false; }
}

// Validate AUTH_URL — if it's garbage (e.g. a secret pasted by mistake), nuke it
if (process.env.AUTH_URL && !isValidUrl(process.env.AUTH_URL)) {
  delete process.env.AUTH_URL;
}

// Validate NEXTAUTH_URL — same protection
if (process.env.NEXTAUTH_URL && !isValidUrl(process.env.NEXTAUTH_URL)) {
  delete process.env.NEXTAUTH_URL;
}

// Map v4 → v5 env var names (only if the v5 name isn't already set)
if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
}
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(function (e) { return e.trim().toLowerCase(); })
  .filter(Boolean);

// ─── PROVIDERS ───────────────────────────────────────────────────────────────
const providers: Provider[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    Apple({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

providers.push(
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      name: { label: 'Name', type: 'text', placeholder: 'Your name' },
    },
    async authorize(credentials) {
      if (credentials?.email) {
        return {
          id: String(credentials.email),
          email: String(credentials.email),
          name: String(credentials.name || credentials.email),
        };
      }
      return null;
    },
  })
);

// ─── NEXTAUTH INIT ───────────────────────────────────────────────────────────
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (token?.isAdmin) {
        session.isAdmin = true;
      }
      return session;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        token.sub = user.id;
      }
      if (token?.email && ADMIN_EMAILS.indexOf(token.email.toLowerCase()) !== -1) {
        token.isAdmin = true;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
