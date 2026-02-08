'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getTeamById, getTeamCSSVars } from '@/lib/nhlTeams';

/**
 * Applies NHL team color theme via CSS custom properties on <html>.
 * All Tailwind classes reference these variables.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const teamThemeId = useStore((s) => s.teamThemeId);

  useEffect(() => {
    const team = getTeamById(teamThemeId);
    const vars = getTeamCSSVars(team);
    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    // Also update the meta theme-color for mobile browsers
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', team.primary);
    }
  }, [teamThemeId]);

  return <>{children}</>;
}
