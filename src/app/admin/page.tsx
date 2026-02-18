'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldX,
  Server,
  Search,
  Users,
  Database,
  Check,
  X,
  Loader2,
  Lock,
  Globe,
  Key,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';

interface ServerConfig {
  auth: {
    googleOAuth: boolean;
    appleOAuth: boolean;
    nextAuthSecret: boolean;
    nextAuthUrl: string;
  };
  search: {
    googleApi: boolean;
    googleCse: boolean;
    brave: boolean;
    tavily: boolean;
    eventbrite: boolean;
  };
  app: {
    seedClinics: number;
    adminEmails: number;
    nodeEnv: string;
    vercelEnv: string;
  };
  user: {
    email: string;
    name: string;
    isAdmin: boolean;
  };
}

function StatusBadge({ configured, label }: { configured: boolean; label: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all',
      configured
        ? 'bg-emerald-500/10 border-emerald-500/20'
        : 'bg-red-500/10 border-red-500/20'
    )}>
      {configured ? (
        <Check size={14} className="text-emerald-400 shrink-0" />
      ) : (
        <X size={14} className="text-red-400 shrink-0" />
      )}
      <span className={cn(
        'text-sm font-medium',
        configured ? 'text-emerald-300' : 'text-red-300'
      )}>
        {label}
      </span>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { clinics, searchMeta } = useStore();
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.isAdmin) {
      setLoading(false);
      return;
    }

    fetch('/api/admin/config')
      .then((res) => {
        if (!res.ok) throw new Error('Access denied');
        return res.json();
      })
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [session, status]);

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <Loader2 size={32} className="text-sky-400 animate-spin" />
      </div>
    );
  }

  // Not logged in or not admin
  if (!session?.isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold theme-text mb-2">Access Denied</h1>
          <p className="text-sm theme-text-secondary mb-6">
            {!session
              ? 'You need to sign in to access the admin dashboard.'
              : 'Your account does not have admin privileges.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 theme-text rounded-xl font-medium text-sm"
            style={{ backgroundColor: 'var(--theme-surface)' }}
          >
            Back to App
          </button>
        </motion.div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <AlertTriangle size={32} className="text-amber-400 mb-4" />
        <p className="theme-text mb-4">{error || 'Failed to load config'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 theme-text rounded-xl font-medium text-sm"
          style={{ backgroundColor: 'var(--theme-surface)' }}
        >
          Back to App
        </button>
      </div>
    );
  }

  const authConfigured = [config.auth.googleOAuth, config.auth.nextAuthSecret].filter(Boolean).length;
  const authTotal = 2; // Google + Secret (Apple is optional)
  const searchConfigured = Object.values(config.search).filter(Boolean).length;
  const searchTotal = Object.keys(config.search).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--theme-bg)' }}>
      <div className="safe-area-top" />
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-4 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--theme-surface)' }}
          >
            <ArrowLeft size={18} className="theme-text-secondary" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold theme-text">Admin Dashboard</h1>
            <p className="text-[10px] theme-text-muted">Logged in as {config.user.email}</p>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold text-amber-400 uppercase">Admin</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="rounded-2xl border p-3 text-center" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}>
            <p className="text-2xl font-bold theme-text">{clinics.length}</p>
            <p className="text-[10px] theme-text-secondary">Clinics Live</p>
          </div>
          <div className="rounded-2xl border p-3 text-center" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}>
            <p className="text-2xl font-bold theme-text">{config.app.seedClinics}</p>
            <p className="text-[10px] theme-text-secondary">Seed Clinics</p>
          </div>
          <div className="rounded-2xl border p-3 text-center" style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}>
            <p className="text-2xl font-bold theme-text">{searchMeta?.sources.length || 0}</p>
            <p className="text-[10px] theme-text-secondary">Data Sources</p>
          </div>
        </div>

        {/* Authentication Config */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 rounded-2xl p-4 border border-sky-500/20 mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
              <Shield size={20} className="text-sky-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold theme-text">Authentication</h3>
              <p className="text-[10px] theme-text-secondary">{authConfigured}/{authTotal} required configured</p>
            </div>
            {authConfigured === authTotal ? (
              <ShieldCheck size={20} className="text-emerald-400" />
            ) : (
              <ShieldX size={20} className="text-amber-400" />
            )}
          </div>
          <div className="space-y-2">
            <StatusBadge configured={config.auth.googleOAuth} label="Google OAuth" />
            <StatusBadge configured={config.auth.appleOAuth} label="Apple Sign In (optional)" />
            <StatusBadge configured={config.auth.nextAuthSecret} label="NextAuth Secret" />
            <div className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border',
              config.auth.nextAuthUrl !== 'not set'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/10 border-red-500/20'
            )}>
              <Globe size={14} className={config.auth.nextAuthUrl !== 'not set' ? 'text-emerald-400' : 'text-red-400'} />
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm font-medium block',
                  config.auth.nextAuthUrl !== 'not set' ? 'text-emerald-300' : 'text-red-300'
                )}>
                  NextAuth URL
                </span>
                <span className="text-[10px] theme-text-muted truncate block">{config.auth.nextAuthUrl}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search API Config */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl p-4 border border-amber-500/20 mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Search size={20} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold theme-text">Search APIs</h3>
              <p className="text-[10px] theme-text-secondary">{searchConfigured}/{searchTotal} configured</p>
            </div>
            {searchConfigured >= 2 ? (
              <Zap size={20} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={20} className="text-amber-400" />
            )}
          </div>
          <div className="space-y-2">
            <StatusBadge configured={config.search.googleApi} label="Google API Key" />
            <StatusBadge configured={config.search.googleCse} label="Google Search Engine ID" />
            <StatusBadge configured={config.search.brave} label="Brave Search API" />
            <StatusBadge configured={config.search.tavily} label="Tavily AI Search" />
            <StatusBadge configured={config.search.eventbrite} label="Eventbrite API" />
          </div>
          {searchConfigured === 0 && (
            <div className="mt-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <p className="text-[11px] text-amber-300">
                No search APIs configured. The app will show curated seed clinics only. Add API keys in Vercel Environment Variables to enable live internet search.
              </p>
            </div>
          )}
        </motion.div>

        {/* Server Environment */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 border mb-4"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Server size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold theme-text">Server Environment</h3>
              <p className="text-[10px] theme-text-secondary">Runtime info</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <span className="text-xs theme-text-secondary">Environment</span>
              <span className="text-xs theme-text font-medium">{config.app.vercelEnv}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <span className="text-xs theme-text-secondary">Node Env</span>
              <span className="text-xs theme-text font-medium">{config.app.nodeEnv}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <span className="text-xs theme-text-secondary">Admin Accounts</span>
              <span className="text-xs theme-text font-medium">{config.app.adminEmails}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
              <span className="text-xs theme-text-secondary">Seed Database</span>
              <span className="text-xs theme-text font-medium">{config.app.seedClinics} clinics</span>
            </div>
          </div>
        </motion.div>

        {/* Users */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 border mb-4"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Users size={20} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold theme-text">User Management</h3>
              <p className="text-[10px] theme-text-secondary">Track registered users</p>
            </div>
          </div>
          <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/10">
            <p className="text-xs text-violet-300 mb-2 font-medium">Current Session</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-300">
                  {(config.user.name || config.user.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium theme-text">{config.user.name}</p>
                  <p className="text-[10px] theme-text-secondary">{config.user.email}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-amber-500/20 text-amber-400">
                  Admin
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-card-border)' }}>
            <div className="flex items-start gap-2">
              <Database size={14} className="theme-text-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] theme-text-secondary">
                  Full user management requires a database connection (Vercel Postgres, Supabase, or PlanetScale).
                  This is planned for the next phase.
                </p>
                <p className="text-[10px] theme-text-muted mt-1">
                  With a database, you&apos;ll be able to see all registered users, their activity, and manage roles.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* How to Configure */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 border"
          style={{ backgroundColor: 'var(--theme-card-bg)', borderColor: 'var(--theme-card-border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Key size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold theme-text">How to Add API Keys</h3>
              <p className="text-[10px] theme-text-secondary">All keys are set as environment variables</p>
            </div>
          </div>
          <ol className="space-y-2 text-xs theme-text-secondary">
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-400">1.</span>
              <span>Go to <strong className="theme-text">vercel.com</strong> &rarr; your project &rarr; Settings &rarr; Environment Variables</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-400">2.</span>
              <span>Add the key name (e.g. <code className="px-1 rounded text-[10px]" style={{ backgroundColor: 'var(--theme-surface)' }}>GOOGLE_API_KEY</code>) and paste the value</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-emerald-400">3.</span>
              <span>Redeploy: Deployments tab &rarr; latest &rarr; &hellip; &rarr; Redeploy</span>
            </li>
          </ol>
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-card-border)' }}>
            <p className="text-[10px] theme-text-muted font-medium mb-2">REQUIRED ENV VARS</p>
            <div className="grid grid-cols-1 gap-1">
              {[
                { name: 'ADMIN_EMAILS', desc: 'Your email (comma-separated for multiple)' },
                { name: 'GOOGLE_CLIENT_ID', desc: 'Google OAuth login' },
                { name: 'GOOGLE_CLIENT_SECRET', desc: 'Google OAuth login' },
                { name: 'NEXTAUTH_SECRET', desc: 'Session encryption' },
                { name: 'NEXTAUTH_URL', desc: 'https://youth-hockey-clinics.vercel.app' },
                { name: 'GOOGLE_API_KEY', desc: 'Search API (primary)' },
                { name: 'GOOGLE_CSE_ID', desc: 'Search Engine ID' },
                { name: 'BRAVE_API_KEY', desc: 'Search API (secondary)' },
                { name: 'TAVILY_API_KEY', desc: 'AI search' },
                { name: 'EVENTBRITE_API_KEY', desc: 'Event search' },
              ].map((env) => (
                <div key={env.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--theme-surface)' }}>
                  <code className="text-[10px] text-emerald-400 font-mono shrink-0">{env.name}</code>
                  <span className="text-[9px] theme-text-muted truncate">{env.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
