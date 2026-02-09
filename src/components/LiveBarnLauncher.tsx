'use client';

import { useState, useEffect } from 'react';
import { X, Video, Smartphone, Monitor, ArrowRight, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LiveBarnVenue } from '@/types';

// LiveBarn App Store IDs
const LIVEBARN_IOS_URL = 'https://apps.apple.com/app/livebarn/id1009591498';
const LIVEBARN_ANDROID_URL =
  'https://play.google.com/store/apps/details?id=com.livebarn.livebarn';

type Platform = 'ios' | 'android' | 'desktop';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export default function LiveBarnLauncher({
  venue,
  onClose,
}: {
  venue: LiveBarnVenue;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [launching, setLaunching] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  // Build the deep link URL based on platform
  // iOS: universal link (opens app if installed, web if not)
  // Android: intent URL with fallback
  const getDeepLink = () => {
    const webUrl = venue.streamUrl;
    if (platform === 'android') {
      // Android intent URL: tries the app first, falls back to web
      return `intent://venue/${encodeURIComponent(venue.name)}#Intent;scheme=livebarn;package=com.livebarn.livebarn;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    }
    // iOS + desktop: universal link / direct URL
    return webUrl;
  };

  const handleLaunch = () => {
    setLaunching(true);
    // Show fallback help after 2 seconds
    setTimeout(() => setShowFallback(true), 2000);
  };

  const appStoreUrl =
    platform === 'android' ? LIVEBARN_ANDROID_URL : LIVEBARN_IOS_URL;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Modal */}
        <motion.div
          initial={{ y: '100%', scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '100%', scale: 0.95 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="relative w-full max-w-md mx-2 mb-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 z-20 transition-colors"
            >
              <X size={18} className="text-white" />
            </button>

            {/* LiveBarn branded header */}
            <div className="relative overflow-hidden">
              <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-900 px-5 pt-5 pb-4">
                {/* Subtle animated glow for live */}
                {venue.isLive && (
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent to-red-500/10 animate-pulse" />
                )}

                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Video size={18} className="text-white" />
                    </div>
                    <span className="text-sm font-bold text-white/90 tracking-wide">
                      LiveBarn
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-tight">
                    {venue.name}
                  </h3>
                  <p className="text-sm text-red-200/80 mt-0.5">
                    {venue.surfaceName}
                  </p>

                  {venue.isLive ? (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                      </span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Live Now
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-3">
                      <Play size={12} className="text-red-300" />
                      <span className="text-xs text-red-200/70">
                        Replay Available
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-3">
              {/* Primary CTA: Open LiveBarn App */}
              {/*
                Using a real <a> tag is critical here.
                On iOS PWA → opens Safari → universal link intercept → LiveBarn app.
                On Android → intent URL → opens LiveBarn app or Play Store fallback.
                This is the production-standard deep link pattern.
              */}
              <a
                href={getDeepLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleLaunch}
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-4 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]',
                  venue.isLive
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-white'
                )}
              >
                <Video size={18} />
                {venue.isLive ? 'Watch Live in LiveBarn' : 'Watch Replay in LiveBarn'}
                <ArrowRight size={16} />
              </a>

              {/* Launch feedback */}
              <AnimatePresence>
                {launching && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-[10px] text-center text-slate-500 py-1">
                      {showFallback
                        ? 'If LiveBarn didn\'t open, you may need to install the app.'
                        : 'Opening LiveBarn...'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-900 px-3 text-[10px] text-slate-600">
                    or
                  </span>
                </div>
              </div>

              {/* Get the app */}
              {platform !== 'desktop' && (
                <a
                  href={appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-xs font-medium transition-colors border border-white/5"
                >
                  <Smartphone size={14} />
                  {platform === 'ios'
                    ? 'Get LiveBarn on App Store'
                    : 'Get LiveBarn on Google Play'}
                </a>
              )}

              {/* Web fallback */}
              <a
                href={venue.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 text-[11px] text-slate-500 hover:text-slate-400 transition-colors"
              >
                <Monitor size={11} />
                Watch on livebarn.com instead
              </a>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
