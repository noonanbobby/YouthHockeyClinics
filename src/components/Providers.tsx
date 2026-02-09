'use client';

import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import TeamThemeProvider from './ThemeProvider';
import { SyncInitializer } from './SyncInitializer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <TeamThemeProvider>
          <SyncInitializer />
          {children}
        </TeamThemeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
