'use client';

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getTeamById } from '@/lib/nhlTeams';

/**
 * Applies NHL team color theme via CSS custom properties.
 * Light mode only — bold, clean, production-grade.
 */
export default function TeamThemeProvider({ children }: { children: React.ReactNode }) {
  const teamThemeId = useStore((s) => s.teamThemeId);

  useEffect(() => {
    const team = getTeamById(teamThemeId);
    const root = document.documentElement;

    // ── Team accent colors ──────────────────────────
    root.style.setProperty('--theme-primary', team.primary);
    root.style.setProperty('--theme-secondary', team.secondary);
    root.style.setProperty('--theme-accent', team.accent);

    // ── Page backgrounds ────────────────────────────
    root.style.setProperty('--theme-bg', '#f0f4f8');
    root.style.setProperty('--theme-header-bg', '#ffffff');
    root.style.setProperty('--theme-nav-bg', '#ffffff');

    // ── Card & surface ──────────────────────────────
    root.style.setProperty('--theme-card-bg', '#ffffff');
    root.style.setProperty('--theme-card-border', `color-mix(in srgb, ${team.primary} 10%, #e2e8f0)`);
    root.style.setProperty('--theme-card-hover', `color-mix(in srgb, ${team.primary} 6%, #f8fafc)`);
    root.style.setProperty('--theme-surface', '#e8edf2');

    // ── Text hierarchy ──────────────────────────────
    root.style.setProperty('--theme-text', '#0f172a');
    root.style.setProperty('--theme-text-secondary', '#475569');
    root.style.setProperty('--theme-text-muted', '#94a3b8');

    // ── Effects ─────────────────────────────────────
    root.style.setProperty('--theme-glow', `color-mix(in srgb, ${team.primary} 12%, transparent)`);
    root.style.setProperty('--theme-shadow-sm', '0 1px 2px rgba(0,0,0,0.04)');
    root.style.setProperty('--theme-shadow', '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)');
    root.style.setProperty('--theme-shadow-md', '0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)');
    root.style.setProperty('--theme-shadow-lg', '0 10px 30px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.03)');

    // ── Body ────────────────────────────────────────
    document.body.style.backgroundColor = '#f0f4f8';

    // ── Mobile browser chrome ───────────────────────
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#ffffff');
  }, [teamThemeId]);

  return <>{children}</>;
}
