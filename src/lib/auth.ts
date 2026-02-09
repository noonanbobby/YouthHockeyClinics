import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';

// NextAuth v5 uses AUTH_SECRET / AUTH_URL instead of NEXTAUTH_SECRET / NEXTAUTH_URL.
// Map the v4 names to v5 so users don't have to rename their Vercel env vars.
if (!process.env.AUTH_SECRET && process.env.NEXTAUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET;
}
if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
}

// Admin emails (comma-separated in env var)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(function (e) { return e.trim().toLowerCase(); })
  .filter(Boolean);

// Only register OAuth providers when credentials are actually configured
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

// Email login always available
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  // CRITICAL: Required for Vercel — trust the proxy X-Forwarded-Host header
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
      // Check admin status by email
      if (token?.email && ADMIN_EMAILS.indexOf(token.email.toLowerCase()) !== -1) {
        token.isAdmin = true;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  // NextAuth v5 uses AUTH_SECRET, but also support NEXTAUTH_SECRET for compatibility
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'hockey-clinics-dev-secret-change-in-production',
});
