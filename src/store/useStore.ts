import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Clinic, FilterState, NotificationItem, ViewMode, Registration, DaySmartConfig, LiveBarnConfig } from '@/types';
import { calculateDistance } from '@/lib/geocoder';

interface AppState {
  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Clinics (from API)
  clinics: Clinic[];
  filteredClinics: Clinic[];
  setClinics: (clinics: Clinic[]) => void;
  selectedClinic: Clinic | null;
  setSelectedClinic: (clinic: Clinic | null) => void;

  // Loading / search state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  isRefreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
  lastUpdated: string | null;
  setLastUpdated: (ts: string) => void;
  searchMeta: {
    totalRaw: number;
    sources: { name: string; count: number; status: string; error?: string }[];
    searchDuration: number;
    hasApiKeys: Record<string, boolean>;
  } | null;
  setSearchMeta: (meta: AppState['searchMeta']) => void;
  error: string | null;
  setError: (error: string | null) => void;

  // Filters
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  applyFilters: () => void;
  activeFilterCount: () => number;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // Favorites
  favoriteIds: string[];
  toggleFavorite: (clinicId: string) => void;
  isFavorite: (clinicId: string) => boolean;

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;

  // Registrations
  registrations: Registration[];
  addRegistration: (reg: Omit<Registration, 'id' | 'registeredAt'>) => void;
  updateRegistration: (id: string, updates: Partial<Registration>) => void;
  removeRegistration: (id: string) => void;

  // DaySmart / Dash integration
  daySmartConfig: DaySmartConfig;
  setDaySmartConfig: (config: Partial<DaySmartConfig>) => void;
  daySmartSyncing: boolean;
  setDaySmartSyncing: (syncing: boolean) => void;

  // LiveBarn integration
  liveBarnConfig: LiveBarnConfig;
  setLiveBarnConfig: (config: Partial<LiveBarnConfig>) => void;

  // Settings / API keys
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  locationEnabled: boolean;
  setLocationEnabled: (enabled: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  homeLocation: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  } | null;
  setHomeLocation: (loc: {
    city: string;
    state: string;
    country: string;
    lat: number;
    lng: number;
  } | null) => void;
  /** Returns the best known location: GPS if available, else home location */
  getEffectiveLocation: () => { lat: number; lng: number } | null;
  preferredCurrency: string;
  setPreferredCurrency: (currency: string) => void;
  apiKeys: {
    serpApiKey: string;
    googleApiKey: string;
    googleCseId: string;
    bingApiKey: string;
    eventbriteApiKey: string;
  };
  setApiKey: (key: keyof AppState['apiKeys'], value: string) => void;
  autoRefreshInterval: number; // minutes
  setAutoRefreshInterval: (minutes: number) => void;

  // Theme / Branding
  teamThemeId: string; // NHL team id, 'default' for sky blue
  setTeamTheme: (teamId: string) => void;

  // UI
  isFilterOpen: boolean;
  setFilterOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const defaultFilters: FilterState = {
  searchQuery: '',
  dateRange: { start: null, end: null },
  ageGroups: [],
  skillLevels: [],
  clinicTypes: [],
  country: null,
  maxPrice: null,
  spotsAvailable: false,
  featured: false,
  sortBy: 'date',
  sortOrder: 'asc',
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // View
      viewMode: 'list',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Clinics
      clinics: [],
      filteredClinics: [],
      setClinics: (clinics) => {
        set({ clinics });
        // Detect new clinics and send notifications
        const state = get();
        const existingIds = new Set(state.clinics.map((c) => c.id));
        const newClinics = clinics.filter((c) => !existingIds.has(c.id));
        if (newClinics.length > 0 && state.clinics.length > 0) {
          // Only notify if we had previous data (not first load)
          for (const nc of newClinics.slice(0, 5)) {
            state.addNotification({
              title: `New: ${nc.name}`,
              body: `${nc.location.city}, ${nc.location.country} — ${nc.dates.start}`,
              clinicId: nc.id,
              type: 'new_clinic',
            });
          }
        }
        // Re-apply filters
        setTimeout(() => get().applyFilters(), 0);
      },
      selectedClinic: null,
      setSelectedClinic: (clinic) => set({ selectedClinic: clinic }),

      // Loading
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
      isRefreshing: false,
      setRefreshing: (refreshing) => set({ isRefreshing: refreshing }),
      lastUpdated: null,
      setLastUpdated: (ts) => set({ lastUpdated: ts }),
      searchMeta: null,
      setSearchMeta: (meta) => set({ searchMeta: meta }),
      error: null,
      setError: (error) => set({ error }),

      // Filters
      filters: defaultFilters,
      setFilter: (key, value) => {
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        }));
        get().applyFilters();
      },
      resetFilters: () => {
        set({ filters: defaultFilters });
        get().applyFilters();
      },
      applyFilters: () => {
        const { filters, clinics } = get();
        let result = [...clinics];

        // Search
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          result = result.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q) ||
              c.location.city.toLowerCase().includes(q) ||
              c.location.country.toLowerCase().includes(q) ||
              c.location.venue.toLowerCase().includes(q) ||
              c.tags.some((t) => t.toLowerCase().includes(q)) ||
              c.coaches.some((coach) => coach.name.toLowerCase().includes(q))
          );
        }

        // Date range
        if (filters.dateRange.start) {
          result = result.filter((c) => c.dates.end >= filters.dateRange.start!);
        }
        if (filters.dateRange.end) {
          result = result.filter((c) => c.dates.start <= filters.dateRange.end!);
        }

        // Age groups
        if (filters.ageGroups.length > 0) {
          result = result.filter((c) =>
            c.ageGroups.some((ag) => filters.ageGroups.includes(ag) || ag === 'all')
          );
        }

        // Skill levels
        if (filters.skillLevels.length > 0) {
          result = result.filter((c) =>
            c.skillLevels.some((sl) => filters.skillLevels.includes(sl) || sl === 'all')
          );
        }

        // Clinic types
        if (filters.clinicTypes.length > 0) {
          result = result.filter((c) => filters.clinicTypes.includes(c.type));
        }

        // Country
        if (filters.country) {
          result = result.filter((c) => c.location.country === filters.country);
        }

        // Spots available
        if (filters.spotsAvailable) {
          result = result.filter((c) => c.spotsRemaining > 0);
        }

        // Featured
        if (filters.featured) {
          result = result.filter((c) => c.featured);
        }

        // Sort
        result.sort((a, b) => {
          let comparison = 0;
          switch (filters.sortBy) {
            case 'date':
              comparison = a.dates.start.localeCompare(b.dates.start);
              break;
            case 'price':
              comparison = a.price.amount - b.price.amount;
              break;
            case 'rating':
              comparison = b.rating - a.rating;
              break;
            case 'name':
              comparison = a.name.localeCompare(b.name);
              break;
            case 'distance': {
              const loc = get().getEffectiveLocation();
              if (loc) {
                const distA = calculateDistance(loc.lat, loc.lng, a.location.lat, a.location.lng);
                const distB = calculateDistance(loc.lat, loc.lng, b.location.lat, b.location.lng);
                comparison = distA - distB;
              } else {
                comparison = a.dates.start.localeCompare(b.dates.start);
              }
              break;
            }
          }
          return filters.sortOrder === 'asc' ? comparison : -comparison;
        });

        set({ filteredClinics: result });
      },
      activeFilterCount: () => {
        const { filters } = get();
        let count = 0;
        if (filters.dateRange.start || filters.dateRange.end) count++;
        if (filters.ageGroups.length > 0) count++;
        if (filters.skillLevels.length > 0) count++;
        if (filters.clinicTypes.length > 0) count++;
        if (filters.country) count++;
        if (filters.spotsAvailable) count++;
        if (filters.featured) count++;
        return count;
      },

      // Search
      searchQuery: '',
      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().setFilter('searchQuery', query);
      },
      recentSearches: [],
      addRecentSearch: (query) => {
        if (!query.trim()) return;
        set((state) => ({
          recentSearches: [
            query,
            ...state.recentSearches.filter((s) => s !== query),
          ].slice(0, 10),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Favorites
      favoriteIds: [],
      toggleFavorite: (clinicId) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(clinicId)
            ? state.favoriteIds.filter((id) => id !== clinicId)
            : [...state.favoriteIds, clinicId],
        })),
      isFavorite: (clinicId) => get().favoriteIds.includes(clinicId),

      // Notifications
      notifications: [],
      unreadCount: 0,
      markAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        }),
      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),
      addNotification: (notification) =>
        set((state) => {
          const newNotif: NotificationItem = {
            ...notification,
            id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          return {
            notifications: [newNotif, ...state.notifications].slice(0, 100),
            unreadCount: state.unreadCount + 1,
          };
        }),

      // Registrations
      registrations: [],
      addRegistration: (reg) =>
        set((state) => ({
          registrations: [
            {
              ...reg,
              id: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              registeredAt: new Date().toISOString(),
            },
            ...state.registrations,
          ],
        })),
      updateRegistration: (id, updates) =>
        set((state) => ({
          registrations: state.registrations.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      removeRegistration: (id) =>
        set((state) => ({
          registrations: state.registrations.filter((r) => r.id !== id),
        })),

      // DaySmart / Dash
      daySmartConfig: {
        email: '',
        password: '',
        facilityId: '',
        facilityName: 'Baptist Health IcePlex',
        connected: false,
        lastSync: null,
      },
      setDaySmartConfig: (config) =>
        set((state) => ({
          daySmartConfig: { ...state.daySmartConfig, ...config },
        })),
      daySmartSyncing: false,
      setDaySmartSyncing: (syncing) => set({ daySmartSyncing: syncing }),

      // LiveBarn
      liveBarnConfig: {
        email: '',
        password: '',
        connected: false,
        venues: [],
      },
      setLiveBarnConfig: (config) =>
        set((state) => ({
          liveBarnConfig: { ...state.liveBarnConfig, ...config },
        })),

      // Settings
      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      locationEnabled: false,
      setLocationEnabled: (enabled) => set({ locationEnabled: enabled }),
      userLocation: null,
      setUserLocation: (loc) => set({ userLocation: loc }),
      homeLocation: null,
      setHomeLocation: (loc) => set({ homeLocation: loc }),
      getEffectiveLocation: () => {
        const state = get();
        if (state.userLocation) return state.userLocation;
        if (state.homeLocation) return { lat: state.homeLocation.lat, lng: state.homeLocation.lng };
        return null;
      },
      preferredCurrency: 'USD',
      setPreferredCurrency: (currency) => set({ preferredCurrency: currency }),
      apiKeys: {
        serpApiKey: '',
        googleApiKey: '',
        googleCseId: '',
        bingApiKey: '',
        eventbriteApiKey: '',
      },
      setApiKey: (key, value) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [key]: value },
        })),
      autoRefreshInterval: 30,
      setAutoRefreshInterval: (minutes) => set({ autoRefreshInterval: minutes }),

      // Theme / Branding
      teamThemeId: 'default',
      setTeamTheme: (teamId) => set({ teamThemeId: teamId }),

      // UI
      isFilterOpen: false,
      setFilterOpen: (open) => set({ isFilterOpen: open }),
      isSearchOpen: false,
      setSearchOpen: (open) => set({ isSearchOpen: open }),
    }),
    {
      name: 'hockey-clinics-storage',
      partialize: (state) => ({
        favoriteIds: state.favoriteIds,
        recentSearches: state.recentSearches,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        notificationsEnabled: state.notificationsEnabled,
        locationEnabled: state.locationEnabled,
        homeLocation: state.homeLocation,
        preferredCurrency: state.preferredCurrency,
        apiKeys: state.apiKeys,
        autoRefreshInterval: state.autoRefreshInterval,
        filters: state.filters,
        lastUpdated: state.lastUpdated,
        registrations: state.registrations,
        daySmartConfig: state.daySmartConfig,
        liveBarnConfig: state.liveBarnConfig,
        teamThemeId: state.teamThemeId,
      }),
    }
  )
);
