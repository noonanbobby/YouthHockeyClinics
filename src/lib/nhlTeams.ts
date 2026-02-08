/**
 * NHL Team Color Themes
 *
 * Each team has primary/secondary colors that can be applied site-wide.
 * Colors are Tailwind-compatible CSS custom properties.
 */

export interface NHLTeam {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  primary: string;    // CSS hex color
  secondary: string;  // CSS hex color
  accent: string;     // CSS hex color (text/highlights)
  bg: string;         // dark background
  conference: 'Eastern' | 'Western';
}

export const NHL_TEAMS: NHLTeam[] = [
  // Default theme
  { id: 'default', name: 'Default (Sky Blue)', city: '', abbreviation: 'DEF', primary: '#0ea5e9', secondary: '#0284c7', accent: '#38bdf8', bg: '#020617', conference: 'Eastern' },

  // Eastern Conference — Atlantic
  { id: 'bos', name: 'Bruins', city: 'Boston', abbreviation: 'BOS', primary: '#FFB81C', secondary: '#000000', accent: '#FFB81C', bg: '#111111', conference: 'Eastern' },
  { id: 'buf', name: 'Sabres', city: 'Buffalo', abbreviation: 'BUF', primary: '#003087', secondary: '#FFB81C', accent: '#FFB81C', bg: '#001540', conference: 'Eastern' },
  { id: 'det', name: 'Red Wings', city: 'Detroit', abbreviation: 'DET', primary: '#CE1126', secondary: '#FFFFFF', accent: '#CE1126', bg: '#1a0000', conference: 'Eastern' },
  { id: 'fla', name: 'Panthers', city: 'Florida', abbreviation: 'FLA', primary: '#C8102E', secondary: '#041E42', accent: '#B9975B', bg: '#041E42', conference: 'Eastern' },
  { id: 'mtl', name: 'Canadiens', city: 'Montreal', abbreviation: 'MTL', primary: '#AF1E2D', secondary: '#192168', accent: '#AF1E2D', bg: '#0c1030', conference: 'Eastern' },
  { id: 'ott', name: 'Senators', city: 'Ottawa', abbreviation: 'OTT', primary: '#C52032', secondary: '#C2912C', accent: '#C2912C', bg: '#1a0000', conference: 'Eastern' },
  { id: 'tbl', name: 'Lightning', city: 'Tampa Bay', abbreviation: 'TBL', primary: '#002868', secondary: '#FFFFFF', accent: '#FFFFFF', bg: '#001234', conference: 'Eastern' },
  { id: 'tor', name: 'Maple Leafs', city: 'Toronto', abbreviation: 'TOR', primary: '#00205B', secondary: '#FFFFFF', accent: '#FFFFFF', bg: '#001030', conference: 'Eastern' },

  // Eastern Conference — Metropolitan
  { id: 'car', name: 'Hurricanes', city: 'Carolina', abbreviation: 'CAR', primary: '#CC0000', secondary: '#000000', accent: '#CC0000', bg: '#1a0000', conference: 'Eastern' },
  { id: 'cbj', name: 'Blue Jackets', city: 'Columbus', abbreviation: 'CBJ', primary: '#002654', secondary: '#CE1126', accent: '#CE1126', bg: '#001230', conference: 'Eastern' },
  { id: 'njd', name: 'Devils', city: 'New Jersey', abbreviation: 'NJD', primary: '#CE1126', secondary: '#000000', accent: '#CE1126', bg: '#0f0000', conference: 'Eastern' },
  { id: 'nyi', name: 'Islanders', city: 'New York', abbreviation: 'NYI', primary: '#00539B', secondary: '#F47D30', accent: '#F47D30', bg: '#002040', conference: 'Eastern' },
  { id: 'nyr', name: 'Rangers', city: 'New York', abbreviation: 'NYR', primary: '#0038A8', secondary: '#CE1126', accent: '#CE1126', bg: '#001540', conference: 'Eastern' },
  { id: 'phi', name: 'Flyers', city: 'Philadelphia', abbreviation: 'PHI', primary: '#F74902', secondary: '#000000', accent: '#F74902', bg: '#1a0800', conference: 'Eastern' },
  { id: 'pit', name: 'Penguins', city: 'Pittsburgh', abbreviation: 'PIT', primary: '#FCB514', secondary: '#000000', accent: '#FCB514', bg: '#111111', conference: 'Eastern' },
  { id: 'wsh', name: 'Capitals', city: 'Washington', abbreviation: 'WSH', primary: '#C8102E', secondary: '#041E42', accent: '#C8102E', bg: '#041E42', conference: 'Eastern' },

  // Western Conference — Central
  { id: 'ari', name: 'Utah Hockey Club', city: 'Utah', abbreviation: 'UTA', primary: '#6CACE4', secondary: '#000000', accent: '#6CACE4', bg: '#0a1520', conference: 'Western' },
  { id: 'chi', name: 'Blackhawks', city: 'Chicago', abbreviation: 'CHI', primary: '#CF0A2C', secondary: '#000000', accent: '#CF0A2C', bg: '#1a0000', conference: 'Western' },
  { id: 'col', name: 'Avalanche', city: 'Colorado', abbreviation: 'COL', primary: '#6F263D', secondary: '#236192', accent: '#236192', bg: '#1a0a12', conference: 'Western' },
  { id: 'dal', name: 'Stars', city: 'Dallas', abbreviation: 'DAL', primary: '#006847', secondary: '#8F8F8C', accent: '#006847', bg: '#001a10', conference: 'Western' },
  { id: 'min', name: 'Wild', city: 'Minnesota', abbreviation: 'MIN', primary: '#154734', secondary: '#DDCBA4', accent: '#A6192E', bg: '#0a1a10', conference: 'Western' },
  { id: 'nsh', name: 'Predators', city: 'Nashville', abbreviation: 'NSH', primary: '#FFB81C', secondary: '#041E42', accent: '#FFB81C', bg: '#041E42', conference: 'Western' },
  { id: 'stl', name: 'Blues', city: 'St. Louis', abbreviation: 'STL', primary: '#002F87', secondary: '#FCB514', accent: '#FCB514', bg: '#001540', conference: 'Western' },
  { id: 'wpg', name: 'Jets', city: 'Winnipeg', abbreviation: 'WPG', primary: '#041E42', secondary: '#004C97', accent: '#AC162C', bg: '#041E42', conference: 'Western' },

  // Western Conference — Pacific
  { id: 'ana', name: 'Ducks', city: 'Anaheim', abbreviation: 'ANA', primary: '#F47A38', secondary: '#B9975B', accent: '#F47A38', bg: '#1a0800', conference: 'Western' },
  { id: 'cgy', name: 'Flames', city: 'Calgary', abbreviation: 'CGY', primary: '#D2001C', secondary: '#F1BE48', accent: '#F1BE48', bg: '#1a0000', conference: 'Western' },
  { id: 'edm', name: 'Oilers', city: 'Edmonton', abbreviation: 'EDM', primary: '#041E42', secondary: '#FF4C00', accent: '#FF4C00', bg: '#041E42', conference: 'Western' },
  { id: 'lak', name: 'Kings', city: 'Los Angeles', abbreviation: 'LAK', primary: '#A2AAAD', secondary: '#000000', accent: '#A2AAAD', bg: '#111111', conference: 'Western' },
  { id: 'sea', name: 'Kraken', city: 'Seattle', abbreviation: 'SEA', primary: '#99D9D9', secondary: '#001628', accent: '#99D9D9', bg: '#001628', conference: 'Western' },
  { id: 'sjs', name: 'Sharks', city: 'San Jose', abbreviation: 'SJS', primary: '#006D75', secondary: '#000000', accent: '#006D75', bg: '#001a1c', conference: 'Western' },
  { id: 'van', name: 'Canucks', city: 'Vancouver', abbreviation: 'VAN', primary: '#00205B', secondary: '#00843D', accent: '#00843D', bg: '#001030', conference: 'Western' },
  { id: 'vgk', name: 'Golden Knights', city: 'Vegas', abbreviation: 'VGK', primary: '#B4975A', secondary: '#333F42', accent: '#B4975A', bg: '#1a1a12', conference: 'Western' },
];

export function getTeamById(id: string): NHLTeam {
  return NHL_TEAMS.find((t) => t.id === id) || NHL_TEAMS[0];
}

/**
 * Generate CSS custom properties for a given team
 */
export function getTeamCSSVars(team: NHLTeam): Record<string, string> {
  return {
    '--theme-primary': team.primary,
    '--theme-secondary': team.secondary,
    '--theme-accent': team.accent,
    '--theme-bg': team.bg,
  };
}
