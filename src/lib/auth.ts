import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Apple from 'next-auth/providers/apple';
import Credentials from 'next-auth/providers/credentials';

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

// Admin emails for admin dashboard access
const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).isAdmin = !!token.isAdmin;
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isAdmin = adminEmails.indexOf((user.email || '').toLowerCase()) !== -1;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'hockey-clinics-dev-secret-change-in-production',
});
