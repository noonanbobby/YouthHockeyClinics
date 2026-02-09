'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import SEED_CLINICS from '@/lib/seedClinics';

/**
 * Hook that manages the clinic search lifecycle:
 * - Initial load from API with hard 30-second client timeout
 * - Periodic auto-refresh
 * - Manual refresh
 * - Never hangs — always resolves
 */
export function useClinicSearch() {
  const {
    setClinics,
    setLoading,
    setRefreshing,
    setLastUpdated,
    setSearchMeta,
    setError,
    apiKeys,
    autoRefreshInterval,
    isLoading,
    isRefreshing,
    clinics,
    getEffectiveLocation,
    homeLocation,
  } = useStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  // Track API keys to auto-refresh when they change
  const prevApiKeysRef = useRef(apiKeys);

  const fetchClinics = useCallback(
    async (query?: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Hard client-side timeout — NEVER wait more than 55 seconds
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), 55000);

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (isRefresh) params.set('refresh', 'true');

        // Pass API keys as params
        if (apiKeys.googleApiKey) params.set('googleApiKey', apiKeys.googleApiKey);
        if (apiKeys.googleCseId) params.set('googleCseId', apiKeys.googleCseId);
        if (apiKeys.braveApiKey) params.set('braveApiKey', apiKeys.braveApiKey);
        if (apiKeys.tavilyApiKey) params.set('tavilyApiKey', apiKeys.tavilyApiKey);
        if (apiKeys.eventbriteApiKey) params.set('eventbriteApiKey', apiKeys.eventbriteApiKey);

        // Pass location for tiered search
        const loc = getEffectiveLocation();
        if (loc) {
          params.set('lat', loc.lat.toString());
          params.set('lng', loc.lng.toString());
        }
        if (homeLocation) {
          params.set('city', homeLocation.city);
          params.set('state', homeLocation.state);
          params.set('country', homeLocation.country);
        }

        const response = await fetch(`/api/search?${params}`, {
          signal: controller.signal,
        });

        clearTimeout(clientTimeout);
        const data = await response.json();

        if (data.success && data.clinics) {
          // If the API returned clinics, use them. Otherwise, ALWAYS fall back to seeds.
          const clinicsToUse = data.clinics.length > 0 ? data.clinics : SEED_CLINICS;
          setClinics(clinicsToUse);
          setLastUpdated(data.meta?.timestamp || new Date().toISOString());
          setSearchMeta({
            totalRaw: data.meta?.totalRawResults || clinicsToUse.length,
            sources: data.meta?.sources || [{ name: 'Curated Database', count: clinicsToUse.length, status: 'success' }],
            searchDuration: data.meta?.searchDuration || 0,
            hasApiKeys: data.meta?.hasApiKeys || { google: false, brave: false, tavily: false, eventbrite: false },
          });
        } else {
          // API returned an error — still load seeds
          setClinics(SEED_CLINICS);
          setSearchMeta({
            totalRaw: SEED_CLINICS.length,
            sources: [{ name: 'Curated Database', count: SEED_CLINICS.length, status: 'success' }],
            searchDuration: 0,
            hasApiKeys: { brave: false, tavily: false, eventbrite: false },
          });
        }
      } catch (err) {
        clearTimeout(clientTimeout);
        // CRITICAL FALLBACK: If the API completely fails, load seed clinics directly
        // so the user ALWAYS sees something (never a blank screen)
        if (clinics.length === 0) {
          setClinics(SEED_CLINICS);
        }
        if (err instanceof DOMException && err.name === 'AbortError') {
          setError('Search timed out. Showing curated clinics. Add API keys in Settings for more results.');
        } else {
          setError('Network issue. Showing curated clinics.');
        }
      } finally {
        // ALWAYS clear loading state — never leave the UI stuck
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiKeys, clinics, setClinics, setLoading, setRefreshing, setLastUpdated, setSearchMeta, setError, getEffectiveLocation, homeLocation]
  );

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchClinics();
    }
  }, [fetchClinics]);

  // Auto-refresh when API keys change (user added/removed a key in Settings)
  useEffect(() => {
    const prev = prevApiKeysRef.current;
    const changed = Object.keys(apiKeys).some(
      (k) => apiKeys[k as keyof typeof apiKeys] !== prev[k as keyof typeof prev]
    );
    prevApiKeysRef.current = apiKeys;
    if (changed && initialLoadDone.current) {
      fetchClinics(undefined, true);
    }
  }, [apiKeys, fetchClinics]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (autoRefreshInterval > 0) {
      intervalRef.current = setInterval(
        () => fetchClinics(undefined, true),
        autoRefreshInterval * 60 * 1000
      );
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefreshInterval, fetchClinics]);

  return {
    refresh: (query?: string) => fetchClinics(query, true),
    search: (query: string) => fetchClinics(query),
    isLoading,
    isRefreshing,
    clinicsCount: clinics.length,
  };
}
