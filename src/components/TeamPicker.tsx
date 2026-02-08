'use client';

import { useStore } from '@/store/useStore';
import { NHL_TEAMS, getTeamById } from '@/lib/nhlTeams';

export default function TeamPicker() {
  const { teamThemeId, setTeamTheme } = useStore();
  const current = getTeamById(teamThemeId);

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-white">Team Colors</label>
      <div className="relative">
        <select
          value={teamThemeId}
          onChange={(e) => setTeamTheme(e.target.value)}
          className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white pr-10 focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)] transition-colors"
          style={{ borderColor: current.id !== 'default' ? current.primary + '40' : undefined }}
        >
          <option value="default" className="bg-slate-900 text-white">
            Default (Sky Blue)
          </option>
          <optgroup label="Eastern Conference" className="bg-slate-900 text-white">
            {NHL_TEAMS.filter((t) => t.conference === 'Eastern' && t.id !== 'default').map((team) => (
              <option key={team.id} value={team.id} className="bg-slate-900 text-white">
                {team.city} {team.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Western Conference" className="bg-slate-900 text-white">
            {NHL_TEAMS.filter((t) => t.conference === 'Western').map((team) => (
              <option key={team.id} value={team.id} className="bg-slate-900 text-white">
                {team.city} {team.name}
              </option>
            ))}
          </optgroup>
        </select>
        {/* Color preview swatch */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
          <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: current.primary }} />
          <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: current.secondary }} />
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
