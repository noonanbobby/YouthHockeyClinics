'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, User, ArrowRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [oauthAvailable, setOauthAvailable] = useState<{ google: boolean; apple: boolean }>({
    google: false,
    apple: false,
  });

  // Check if OAuth providers are configured (env vars exist on server)
  useEffect(() => {
    fetch('/api/auth-check')
      .then((res) => res.json())
      .then((data) => {
        setOauthAvailable({
          google: !!data?.google,
          apple: !!data?.apple,
        });
      })
      .catch(() => {
        // If the check fails, don't show OAuth buttons
      });
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading('google');
    await signIn('google', { callbackUrl: '/' });
  };

  const handleAppleSignIn = async () => {
    setIsLoading('apple');
    await signIn('apple', { callbackUrl: '/' });
  };

  const handleEmailSignIn = async () => {
    if (!email) return;
    setIsLoading('email');
    const result = await signIn('credentials', {
      email,
      name: name || email.split('@')[0],
      redirect: false,
    });
    if (result?.ok) {
      router.push('/');
    }
    setIsLoading(null);
  };

  const handleSkip = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="safe-area-top" />

      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 mb-5 shadow-lg shadow-sky-500/20">
            <span className="text-4xl">🏒</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Noonan Hockey</h1>
          <p className="text-sm text-slate-400">
            The world&apos;s most comprehensive hockey clinic finder
          </p>
        </motion.div>

        {/* Primary CTA — Start Exploring */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <button
            onClick={handleSkip}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25"
          >
            <Zap size={18} />
            Start Exploring Clinics
          </button>
        </motion.div>

        {/* OAuth buttons — only show when configured */}
        {(oauthAvailable.google || oauthAvailable.apple) && (
          <>
            <div className="flex items-center gap-4 my-2 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">or sign in</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-3 mb-6"
            >
              {oauthAvailable.google && (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={!!isLoading}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border transition-all font-medium text-sm',
                    'bg-white text-slate-900 border-white/20 hover:bg-slate-100 active:scale-[0.98]',
                    isLoading === 'google' && 'opacity-70'
                  )}
                >
                  {isLoading === 'google' ? (
                    <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  Continue with Google
                </button>
              )}

              {oauthAvailable.apple && (
                <button
                  onClick={handleAppleSignIn}
                  disabled={!!isLoading}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border transition-all font-medium text-sm',
                    'bg-black text-white border-white/20 hover:bg-slate-900 active:scale-[0.98]',
                    isLoading === 'apple' && 'opacity-70'
                  )}
                >
                  {isLoading === 'apple' ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                  )}
                  Continue with Apple
                </button>
              )}
            </motion.div>
          </>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 my-2 mb-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500 uppercase tracking-wider">or use email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email Login */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3 mb-8"
        >
          <div className="relative">
            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500/50"
            />
          </div>

          <button
            onClick={handleEmailSignIn}
            disabled={!email || !!isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm transition-all active:scale-[0.98]',
              email
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            )}
          >
            {isLoading === 'email' ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Continue with Email
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 text-center">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          Your data stays on your device unless you choose to sync.
        </p>
      </div>
    </div>
  );
}
