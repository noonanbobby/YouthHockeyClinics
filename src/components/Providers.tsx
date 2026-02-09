'use client';

import { SessionProvider } from 'next-auth/react';
import TeamThemeProvider from './ThemeProvider';
import { SyncInitializer } from './SyncInitializer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TeamThemeProvider>
        <SyncInitializer />
        {children}
      </TeamThemeProvider>
    </SessionProvider>
  );
}
