'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getTeamById } from '@/lib/nhlTeams';

/**
 * Applies NHL team color theme via CSS custom properties on <html>.
 * Makes the ENTIRE app feel like that team's official page.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const teamThemeId = useStore((s) => s.teamThemeId);

  useEffect(() => {
    const team = getTeamById(teamThemeId);
    const root = document.documentElement;

    // Core colors
    root.style.setProperty('--theme-primary', team.primary);
    root.style.setProperty('--theme-secondary', team.secondary);
    root.style.setProperty('--theme-accent', team.accent);
    root.style.setProperty('--theme-bg', team.bg);

    // Derived colors for immersive theming
    root.style.setProperty('--theme-header-bg', team.bg);
    root.style.setProperty('--theme-card-bg', `color-mix(in srgb, ${team.primary} 5%, ${team.bg})`);
    root.style.setProperty('--theme-card-border', `color-mix(in srgb, ${team.primary} 12%, transparent)`);
    root.style.setProperty('--theme-card-hover', `color-mix(in srgb, ${team.primary} 20%, transparent)`);
    root.style.setProperty('--theme-surface', `color-mix(in srgb, ${team.primary} 3%, ${team.bg})`);
    root.style.setProperty('--theme-nav-bg', team.bg);
    root.style.setProperty('--theme-glow', `color-mix(in srgb, ${team.primary} 40%, transparent)`);

    // Update body background
    document.body.style.backgroundColor = team.bg;

    // Update meta theme-color for mobile browser chrome
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', team.bg);
  }, [teamThemeId]);

  return <>{children}</>;
}
