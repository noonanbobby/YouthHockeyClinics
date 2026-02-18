'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store/useStore';

const SYNC_DEBOUNCE_MS = 3000;

// Keys to sync to the server
const SYNC_KEYS = [
  'favoriteIds',
  'childProfiles',
  'activeChildIds',
  'registrations',
  'teamThemeId',
  'colorMode',
  'homeLocation',
  'notificationsEnabled',
  'autoRefreshInterval',
  'preferredCurrency',
  'daySmartConfig',
  'iceHockeyProConfig',
  'emailScanConfig',
] as const;

function getSyncableState(state: ReturnType<typeof useStore.getState>) {
  const syncable: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    syncable[key] = state[key as keyof typeof state];
  }

  // Strip the IceHockeyPro session cookie — it's ephemeral and should
  // never be persisted to Supabase (it expires and is per-device).
  if (syncable.iceHockeyProConfig && typeof syncable.iceHockeyProConfig === 'object') {
    const ihp = { ...(syncable.iceHockeyProConfig as Record<string, unknown>) };
    delete ihp.sessionCookie;
    syncable.iceHockeyProConfig = ihp;
  }

  return syncable;
}

export function useSync() {
  const { data: session, status } = useSession();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPulledRef = useRef(false);
  // Guard: true while we are applying a remote pull to the store.
  // Prevents the store subscription from immediately pushing the
  // just-pulled data back to the server (write-back loop).
  const isPullingRef = useRef(false);

  // ── Push local settings to remote (debounced) ──────────────────────
  const pushSettings = useCallback(async () => {
    // Never push while we are in the middle of applying a pull
    if (isPullingRef.current) return;

    try {
      const state = useStore.getState();
      const settings = getSyncableState(state);

      await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
    } catch {
      // Silent fail — next change will retry
    }
  }, []);

  // ── Pull remote settings on login ──────────────────────────────────
  const pullSettings = useCallback(async () => {
    if (hasPulledRef.current) return;
    hasPulledRef.current = true;

    try {
      const res = await fetch('/api/sync');
      if (!res.ok) return;

      const data = await res.json();
      if (!data.settings) return;

      const store = useStore.getState();
      const remote = data.settings;

      // Set the pull guard BEFORE mutating the store so the subscription
      // does not schedule a push for these changes.
      isPullingRef.current = true;

      try {
        // Merge strategy: remote wins for simple scalar values;
        // union arrays so local + remote favorites are both kept.
        if (remote.favoriteIds?.length) {
          const merged = [...new Set([...store.favoriteIds, ...remote.favoriteIds])];
          useStore.setState({ favoriteIds: merged });
        }
        if (remote.childProfiles?.length && !store.childProfiles.length) {
          useStore.setState({
            childProfiles: remote.childProfiles,
            activeChildIds: remote.activeChildIds || [],
          });
        }
        if (remote.registrations?.length && !store.registrations.length) {
          useStore.setState({ registrations: remote.registrations });
        }
        if (remote.teamThemeId) {
          useStore.setState({ teamThemeId: remote.teamThemeId });
        }
        if (remote.colorMode) {
          useStore.setState({ colorMode: remote.colorMode });
        }
        if (remote.homeLocation && !store.homeLocation) {
          useStore.setState({ homeLocation: remote.homeLocation });
        }
        // Restore integration configs (passwords already decrypted by the API)
        if (remote.daySmartConfig?.email && !store.daySmartConfig.email) {
          useStore.setState({ daySmartConfig: remote.daySmartConfig });
        }
        if (remote.iceHockeyProConfig?.email && !store.iceHockeyProConfig.email) {
          useStore.setState({ iceHockeyProConfig: remote.iceHockeyProConfig });
        }
      } finally {
        // Always release the pull guard, even if setState throws
        // Use a short delay so the Zustand subscriber fires first
        setTimeout(() => {
          isPullingRef.current = false;
        }, 100);
      }
    } catch {
      // Sync is optional — don't break the app
      hasPulledRef.current = false; // Allow retry on next mount
    }
  }, []);

  // ── Pull on authentication ─────────────────────────────────────────
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      pullSettings();
    }
    // Reset pull flag on sign-out so next login pulls fresh data
    if (status === 'unauthenticated') {
      hasPulledRef.current = false;
      isPullingRef.current = false;
    }
  }, [status, session?.user?.email, pullSettings]);

  // ── Subscribe to store changes and push (debounced) ────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    const unsub = useStore.subscribe(() => {
      // Skip push if we are currently applying a remote pull
      if (isPullingRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(pushSettings, SYNC_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [status, pushSettings]);
}
