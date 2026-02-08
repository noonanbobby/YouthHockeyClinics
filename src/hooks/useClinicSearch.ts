'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';

/**
 * Hook that manages the clinic search lifecycle:
 * - Initial load from API
 * - Periodic auto-refresh
 * - Manual refresh
 * - Error handling
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
  } = useStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);

  const fetchClinics = useCallback(
    async (query?: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (isRefresh) params.set('refresh', 'true');

        // Pass API keys as params (in production, use secure cookies or server env)
        if (apiKeys.serpApiKey) params.set('serpApiKey', apiKeys.serpApiKey);
        if (apiKeys.googleApiKey) params.set('googleApiKey', apiKeys.googleApiKey);
        if (apiKeys.googleCseId) params.set('googleCseId', apiKeys.googleCseId);
        if (apiKeys.bingApiKey) params.set('bingApiKey', apiKeys.bingApiKey);
        if (apiKeys.eventbriteApiKey) params.set('eventbriteApiKey', apiKeys.eventbriteApiKey);

        const response = await fetch(`/api/search?${params}`);
        const data = await response.json();

        if (data.success && data.clinics) {
          setClinics(data.clinics);
          setLastUpdated(data.meta.timestamp);
          setSearchMeta({
            totalRaw: data.meta.totalRawResults,
            sources: data.meta.sources,
            searchDuration: data.meta.searchDuration,
            hasApiKeys: data.meta.hasApiKeys,
          });
        } else {
          setError(data.error || 'Failed to fetch clinics');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiKeys, setClinics, setLoading, setRefreshing, setLastUpdated, setSearchMeta, setError]
  );

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchClinics();
    }
  }, [fetchClinics]);

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
