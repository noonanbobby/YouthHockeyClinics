'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Hockey-themed loading animation — an animated puck that spins and bounces
 * with crossing sticks underneath. Used throughout the app instead of generic spinners.
 */
export function HockeyLoader({ size = 'md', message }: { size?: 'sm' | 'md' | 'lg'; message?: string }) {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const puckSize = size === 'sm' ? 24 : size === 'lg' ? 48 : 36;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn('relative', dims)}>
        {/* Spinning puck */}
        <motion.svg
          viewBox="0 0 48 48"
          width={puckSize}
          height={puckSize}
          className="mx-auto"
          animate={{ rotateY: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ perspective: 200 }}
        >
          {/* Puck body */}
          <ellipse cx="24" cy="28" rx="18" ry="6" fill="#1e293b" />
          <rect x="6" y="16" width="36" height="12" rx="2" fill="#0f172a" />
          <ellipse cx="24" cy="16" rx="18" ry="6" fill="#1e293b" />
          {/* Puck stripe */}
          <ellipse cx="24" cy="16" rx="14" ry="4" fill="none" stroke="var(--theme-primary)" strokeWidth="1.5" opacity="0.6" />
          {/* Shine */}
          <ellipse cx="20" cy="14" rx="4" ry="2" fill="white" opacity="0.15" />
        </motion.svg>

        {/* Bouncing shadow */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-white/5"
          animate={{
            width: [puckSize * 0.6, puckSize * 0.8, puckSize * 0.6],
            height: [3, 5, 3],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Crossed sticks */}
      {size !== 'sm' && (
        <motion.div
          className="flex justify-center -mt-1"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-lg" style={{ transform: 'rotate(-30deg) translateX(4px)' }}>🏒</span>
          <span className="text-lg" style={{ transform: 'rotate(30deg) scaleX(-1) translateX(4px)' }}>🏒</span>
        </motion.div>
      )}

      {message && (
        <motion.p
          className={cn(textSize, 'text-slate-400 text-center')}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}

/**
 * Skeleton card that mimics the ClinicCard shape with a pulsing animation.
 * Shows while clinics are loading for a smooth perceived performance.
 */
export function ClinicCardSkeleton() {
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="h-36 bg-white/[0.04] relative">
        <div className="absolute top-3 left-3 w-16 h-5 bg-white/[0.06] rounded-full" />
        <div className="absolute top-3 right-3 w-8 h-8 bg-white/[0.06] rounded-full" />
      </div>
      {/* Content skeleton */}
      <div className="p-3 space-y-2.5">
        <div className="h-4 bg-white/[0.06] rounded-lg w-3/4" />
        <div className="flex items-center gap-2">
          <div className="h-3 bg-white/[0.04] rounded w-20" />
          <div className="h-3 bg-white/[0.04] rounded w-16" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="h-3.5 bg-white/[0.06] rounded w-14" />
          <div className="h-3 bg-white/[0.04] rounded w-24" />
        </div>
        <div className="flex gap-1.5 pt-0.5">
          <div className="h-5 bg-white/[0.04] rounded-full w-14" />
          <div className="h-5 bg-white/[0.04] rounded-full w-18" />
          <div className="h-5 bg-white/[0.04] rounded-full w-12" />
        </div>
      </div>
    </div>
  );
}

/**
 * A row of skeleton cards for list loading state.
 */
export function ClinicListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <ClinicCardSkeleton />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Full-page hockey loading screen with centered puck animation.
 */
export function HockeyLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <HockeyLoader size="lg" message={message || 'Scanning the ice...'} />
    </div>
  );
}
