'use client';

import { useStore } from '@/store/useStore';
import { NHL_TEAMS, getTeamById } from '@/lib/nhlTeams';

export default function TeamPicker() {
  const { teamThemeId, setTeamTheme } = useStore();
  const current = getTeamById(teamThemeId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-900">Team Colors</label>
      <div className="relative">
        <select
          value={teamThemeId}
          onChange={(e) => setTeamTheme(e.target.value)}
          className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] transition-colors [color-scheme:light]"
          style={{ borderColor: current.id !== 'default' ? current.primary + '40' : undefined }}
        >
          <option value="default" className="bg-white text-slate-900">
            Default (Sky Blue)
          </option>
          <optgroup label="Eastern Conference" className="bg-white text-slate-900">
            {NHL_TEAMS.filter((t) => t.conference === 'Eastern' && t.id !== 'default').map((team) => (
              <option key={team.id} value={team.id} className="bg-white text-slate-900">
                {team.city} {team.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Western Conference" className="bg-white text-slate-900">
            {NHL_TEAMS.filter((t) => t.conference === 'Western').map((team) => (
              <option key={team.id} value={team.id} className="bg-white text-slate-900">
                {team.city} {team.name}
              </option>
            ))}
          </optgroup>
        </select>
        {/* Color preview swatch */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
          <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: current.primary }} />
          <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: current.secondary }} />
        </div>
      </div>
      {current.id !== 'default' && (
        <p className="text-xs text-slate-500">
          Themed with {current.city} {current.name} colors
        </p>
      )}
    </div>
  );
}
