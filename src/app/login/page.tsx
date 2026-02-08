'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, User, ArrowRight, Chrome } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState<string | null>(null);

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

        {/* Social Login Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3 mb-6"
        >
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
              <Chrome size={20} />
            )}
            Continue with Google
          </button>

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
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-2 mb-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
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
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20'
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

        {/* Skip for now */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4"
          >
            Skip for now — browse without an account
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
