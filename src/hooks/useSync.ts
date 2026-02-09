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
  return syncable;
}

export function useSync() {
  const { data: session, status } = useSession();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const hasPulledRef = useRef(false);

  // Pull remote settings on login
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

      // Merge strategy: remote wins for simple values, union for arrays
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

      lastSyncedRef.current = data.updatedAt;
    } catch {
      // Sync is optional — don't break the app
    }
  }, []);

  // Push local settings to remote (debounced)
  const pushSettings = useCallback(async () => {
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

  // Pull on authentication
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      pullSettings();
    }
  }, [status, session?.user?.email, pullSettings]);

  // Subscribe to store changes and push (debounced)
  useEffect(() => {
    if (status !== 'authenticated') return;

    const unsub = useStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(pushSettings, SYNC_DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [status, pushSettings]);
}
