'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store/useStore';

const SYNC_DEBOUNCE_MS = 3000;

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

  // Strip the IceHockeyPro session cookie — ephemeral, per-device, not
  // suitable for cross-device sync.
  if (
    syncable.iceHockeyProConfig &&
    typeof syncable.iceHockeyProConfig === 'object'
  ) {
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
  const isPullingRef = useRef(false);
  const mountedRef = useRef(true);

  // Track mounted state so async callbacks don't update refs after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Push local settings to remote (debounced) ──────────────────────
  const pushSettings = useCallback(async () => {
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

      // Set pull guard BEFORE mutating the store to prevent the
      // store subscription from scheduling a push for these changes.
      isPullingRef.current = true;

      try {
        if (remote.favoriteIds?.length) {
          const merged = [
            ...new Set([...store.favoriteIds, ...remote.favoriteIds]),
          ];
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
        if (remote.daySmartConfig?.email && !store.daySmartConfig.email) {
          useStore.setState({ daySmartConfig: remote.daySmartConfig });
        }
        if (
          remote.iceHockeyProConfig?.email &&
          !store.iceHockeyProConfig.email
        ) {
          useStore.setState({ iceHockeyProConfig: remote.iceHockeyProConfig });
        }
      } finally {
        // Release the pull guard after Zustand subscribers have fired.
        // Only update the ref if the component is still mounted.
        setTimeout(() => {
          if (mountedRef.current) {
            isPullingRef.current = false;
          }
        }, 150);
      }
    } catch {
      // Sync is optional — don't break the app
      if (mountedRef.current) {
        hasPulledRef.current = false; // Allow retry on next mount
      }
    }
  }, []);

  // ── Pull on authentication ─────────────────────────────────────────
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      pullSettings();
    }
    if (status === 'unauthenticated') {
      hasPulledRef.current = false;
      isPullingRef.current = false;
    }
  }, [status, session?.user?.email, pullSettings]);

  // ── Subscribe to store changes and push (debounced) ────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;

    const unsub = useStore.subscribe(() => {
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
