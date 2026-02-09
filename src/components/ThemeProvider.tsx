'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getTeamById } from '@/lib/nhlTeams';
import { useTheme } from 'next-themes';

/**
 * Applies NHL team color theme via CSS custom properties.
 * Adapts colors for both light and dark modes.
 */
export default function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const teamThemeId = useStore((s) => s.teamThemeId);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const team = getTeamById(teamThemeId);
    const root = document.documentElement;
    const isDark = resolvedTheme === 'dark';

    // Core colors (same in both modes)
    root.style.setProperty('--theme-primary', team.primary);
    root.style.setProperty('--theme-secondary', team.secondary);
    root.style.setProperty('--theme-accent', team.accent);

    if (isDark) {
      // Dark mode: solid card backgrounds with clear contrast from page bg
      root.style.setProperty('--theme-bg', team.bg);
      root.style.setProperty('--theme-header-bg', `color-mix(in srgb, ${team.bg} 80%, #1e293b)`);
      root.style.setProperty('--theme-card-bg', `color-mix(in srgb, ${team.bg} 50%, #1e293b)`);
      root.style.setProperty('--theme-card-border', `color-mix(in srgb, ${team.primary} 18%, rgba(255,255,255,0.06))`);
      root.style.setProperty('--theme-card-hover', `color-mix(in srgb, ${team.primary} 25%, rgba(255,255,255,0.08))`);
      root.style.setProperty('--theme-surface', `color-mix(in srgb, ${team.bg} 65%, #1e293b)`);
      root.style.setProperty('--theme-nav-bg', `color-mix(in srgb, ${team.bg} 85%, #1e293b)`);
      root.style.setProperty('--theme-glow', `color-mix(in srgb, ${team.primary} 40%, transparent)`);
      root.style.setProperty('--theme-text', '#f1f5f9');
      root.style.setProperty('--theme-text-secondary', '#94a3b8');
      root.style.setProperty('--theme-text-muted', '#64748b');
      document.body.style.backgroundColor = team.bg;
    } else {
      // Light mode: clean white with team accent touches
      root.style.setProperty('--theme-bg', '#f8fafc');
      root.style.setProperty('--theme-header-bg', '#ffffff');
      root.style.setProperty('--theme-card-bg', '#ffffff');
      root.style.setProperty('--theme-card-border', `color-mix(in srgb, ${team.primary} 12%, #e2e8f0)`);
      root.style.setProperty('--theme-card-hover', `color-mix(in srgb, ${team.primary} 8%, #f1f5f9)`);
      root.style.setProperty('--theme-surface', '#f1f5f9');
      root.style.setProperty('--theme-nav-bg', '#ffffff');
      root.style.setProperty('--theme-glow', `color-mix(in srgb, ${team.primary} 15%, transparent)`);
      root.style.setProperty('--theme-text', '#0f172a');
      root.style.setProperty('--theme-text-secondary', '#475569');
      root.style.setProperty('--theme-text-muted', '#94a3b8');
      document.body.style.backgroundColor = '#f8fafc';
    }

    // Update meta theme-color for mobile browser chrome
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', isDark ? team.bg : '#ffffff');
  }, [teamThemeId, resolvedTheme]);

  return <>{children}</>;
}
