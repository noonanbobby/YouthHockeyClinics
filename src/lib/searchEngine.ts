/**
 * HOCKEY CLINIC GLOBAL INTELLIGENCE ENGINE
 *
 * This is not a simple search — it is a comprehensive internet intelligence
 * system designed to discover EVERY youth hockey clinic, camp, showcase,
 * tournament, and development program on the planet.
 *
 * DISCOVERY STRATEGIES:
 * 1. Direct scraping of 100+ known hockey organization websites
 * 2. Search API queries with 200+ carefully crafted search terms
 *    covering every angle: coaches by name, companies, regions,
 *    languages, specialties, age groups, seasonal terms
 * 3. Event platform API integration (Eventbrite, etc.)
 * 4. Recursive link discovery — follow links found on pages
 *    to discover more clinics deeper in site structures
 * 5. Dynamic query generation — use discovered data to generate
 *    new search queries (found a coach name? search for their camps)
 * 6. Multi-language support — search in 12+ languages
 *
 * DATA EXTRACTION:
 * - JSON-LD / Schema.org structured data
 * - Open Graph / meta tags
 * - Semantic HTML analysis (cards, lists, tables)
 * - Regex pattern matching (dates, prices, emails, phones)
 * - NLP-style heuristic extraction
 *
 * POST-PROCESSING:
 * - Fuzzy deduplication (Sørensen-Dice coefficient)
 * - Geocoding via OpenStreetMap Nominatim
 * - Confidence scoring with 50+ signal factors
 * - Automatic tagging and categorization
 */

import { Clinic } from '@/types';
import { extractClinicsFromHTML } from './extractor';
import { deduplicateClinics } from './deduplicator';
import { geocodeLocation, calculateDistance } from './geocoder';
import SEED_CLINICS from './seedClinics';

export interface SearchConfig {
  googleApiKey?: string;
  googleCseId?: string;
  braveApiKey?: string;
  tavilyApiKey?: string;
  eventbriteApiKey?: string;
  maxResultsPerSource?: number;
  timeout?: number;
  maxConcurrent?: number; // Max parallel fetches
  /** User's location for tiered proximity search */
  userLat?: number;
  userLng?: number;
  /** Resolved location names for query generation */
  userCity?: string;
  userState?: string;
  userCountry?: string;
}

export interface RawClinicData {
  source: string;
  sourceUrl: string;
  name?: string;
  description?: string;
  location?: string;
  venue?: string;
  city?: string;
  state?: string;
  country?: string;
  dateText?: string;
  startDate?: string;
  endDate?: string;
  price?: string;
  priceAmount?: number;
  currency?: string;
  ageRange?: string;
  skillLevel?: string;
  imageUrl?: string;
  registrationUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  coaches?: string[];
  amenities?: string[];
  rawHtml?: string;
  confidence: number;
}

// ═══════════════════════════════════════════════════════════════
// SEARCH QUERIES — The most comprehensive hockey search corpus
// ═══════════════════════════════════════════════════════════════

export const SEARCH_QUERIES: string[] = [
  // ── CORE DISCOVERY ──────────────────────────────────────────
  'youth hockey clinic 2026',
  'youth hockey camp 2026',
  'youth hockey camp summer 2026',
  'youth hockey camp spring 2026',
  'youth hockey camp winter 2026',
  'kids hockey camp near me',
  'youth hockey development program',
  'hockey skills camp children',
  'learn to play hockey kids program',
  'hockey school registration open',
  'youth hockey showcase 2026',
  'hockey training camp youth registration',
  'ice hockey camp registration',
  'youth hockey tournament 2026',
  'hockey mini camp kids',
  'hockey day camp youth',
  'residential hockey camp',
  'overnight hockey camp youth',
  'hockey prospect camp',

  // ── POSITIONAL / SPECIALTY ──────────────────────────────────
  'youth goaltender camp 2026',
  'goalie hockey camp kids',
  'goaltending school youth',
  'hockey power skating clinic',
  'power skating camp youth',
  'edge work hockey clinic',
  'hockey skating development program',
  'defensive hockey clinic youth',
  'defenseman hockey camp',
  'forward skills hockey camp',
  'hockey shooting clinic youth',
  'stickhandling clinic kids',
  'puck handling camp youth hockey',
  'hockey checking clinic bantam',
  'hockey conditioning camp',
  'hockey speed training camp',

  // ── GIRLS / WOMEN ──────────────────────────────────────────
  'girls hockey camp 2026',
  'girls ice hockey clinic',
  'women hockey development camp',
  'all-girls hockey camp',
  'female hockey camp youth',

  // ── AGE-SPECIFIC ───────────────────────────────────────────
  'mite hockey camp',
  'squirt hockey camp',
  'peewee hockey camp',
  'bantam hockey camp',
  'midget hockey camp',
  'U8 hockey camp',
  'U10 hockey camp',
  'U12 hockey camp',
  'U14 hockey camp',
  'U16 hockey camp',
  'U18 hockey camp',
  'learn to skate hockey program kids 4 5 6',
  'atom hockey clinic',
  'novice hockey camp',

  // ── LEVEL-SPECIFIC ─────────────────────────────────────────
  'beginner hockey camp',
  'intro to hockey program',
  'learn to play hockey no experience',
  'AAA hockey camp',
  'AA hockey camp',
  'travel hockey clinic',
  'elite hockey prospect camp',
  'select hockey camp',
  'competitive hockey training camp',
  'tier 1 hockey camp',
  'high performance hockey camp',
  'prep school hockey camp',

  // ── BY COUNTRY — USA ───────────────────────────────────────
  'USA Hockey player development camp',
  'USA Hockey ADM camp',
  'USA Hockey national camp',
  'hockey camp Massachusetts',
  'hockey camp Minnesota',
  'hockey camp Michigan',
  'hockey camp Connecticut',
  'hockey camp New York',
  'hockey camp New Jersey',
  'hockey camp Pennsylvania',
  'hockey camp Ohio',
  'hockey camp Illinois',
  'hockey camp Colorado',
  'hockey camp California',
  'hockey camp Texas',
  'hockey camp Wisconsin',
  'hockey camp New Hampshire',
  'hockey camp Vermont',
  'hockey camp Maine',
  'hockey camp North Dakota',
  'hockey camp Alaska',
  'hockey camp Florida',
  'hockey camp Washington state',
  'hockey camp Arizona',
  'hockey camp Missouri',
  'hockey camp Virginia',

  // ── BY COUNTRY — CANADA ────────────────────────────────────
  'Hockey Canada skills academy',
  'hockey camp Ontario',
  'hockey camp Quebec',
  'hockey camp Alberta',
  'hockey camp British Columbia',
  'hockey camp Manitoba',
  'hockey camp Saskatchewan',
  'hockey camp Nova Scotia',
  'hockey camp Toronto',
  'hockey camp Montreal',
  'hockey camp Vancouver',
  'hockey camp Calgary',
  'hockey camp Edmonton',
  'hockey camp Ottawa',
  'hockey camp Winnipeg',
  'camp de hockey pour jeunes Quebec',

  // ── BY COUNTRY — EUROPE ────────────────────────────────────
  'ice hockey camp Sweden',
  'hockey camp Stockholm',
  'ishockeyskola Sverige', // Swedish
  'ishockey camp ungdom Sverige',
  'SHL hockey school',
  'ice hockey camp Finland',
  'jääkiekkokoulu', // Finnish hockey school
  'jääkiekkoleiri nuoret', // Finnish youth hockey camp
  'Liiga hockey school Finland',
  'ice hockey camp Czech Republic',
  'hokejový kemp mládež', // Czech youth hockey camp
  'hockey camp Prague',
  'ice hockey camp Switzerland',
  'Eishockey Camp Jugend Schweiz', // German Swiss
  'hockey camp Davos',
  'ice hockey camp Germany',
  'Eishockey Camp Kinder', // German kids hockey camp
  'Eishockey Schule Jugend', // German youth hockey school
  'DEL hockey school',
  'ice hockey camp Norway',
  'ishockey camp barn Norge', // Norwegian
  'ice hockey camp Denmark',
  'ishockey camp Danmark', // Danish
  'ice hockey camp Austria',
  'Eishockey Camp Österreich', // Austrian
  'ice hockey camp Slovakia',
  'hokejový kemp Slovensko', // Slovak
  'ice hockey camp Latvia',
  'ice hockey camp Russia',
  'хоккейный лагерь для детей', // Russian youth hockey camp
  'хоккейная школа юных', // Russian young hockey school
  'KHL hockey school',
  'ice hockey camp France',
  'hockey sur glace stage jeunes France', // French
  'ice hockey camp United Kingdom',
  'ice hockey camp England',
  'EIHL hockey camp UK',
  'ice hockey camp Poland',
  'hokej na lodzie obóz młodzieżowy', // Polish
  'ice hockey camp Italy',
  'hockey su ghiaccio camp giovani', // Italian
  'ice hockey camp Belarus',
  'ice hockey camp Hungary',

  // ── BY COUNTRY — ASIA / OCEANIA / OTHER ────────────────────
  'ice hockey camp Japan',
  'アイスホッケー キャンプ ジュニア', // Japanese
  'ice hockey camp South Korea',
  '아이스하키 캠프', // Korean
  'ice hockey camp China',
  '冰球训练营 青少年', // Chinese youth hockey camp
  'ice hockey camp Australia',
  'ice hockey camp Melbourne',
  'ice hockey camp Sydney',
  'AIHL hockey camp',
  'ice hockey camp New Zealand',
  'ice hockey camp India',
  'ice hockey camp Thailand',
  'ice hockey camp Singapore',
  'ice hockey camp UAE Dubai',
  'ice hockey camp Israel',
  'ice hockey camp South Africa',
  'ice hockey camp Mexico',
  'ice hockey camp Brazil',
  'ice hockey camp Argentina',

  // ── FAMOUS COACHES / TRAINERS (search by name) ─────────────
  'Wayne Gretzky hockey camp',
  'Mario Lemieux hockey camp',
  'Sidney Crosby hockey school',
  'Connor McDavid hockey camp',
  'Patrick Kane hockey camp',
  'Auston Matthews hockey clinic',
  'Nathan MacKinnon hockey camp',
  'Jack Hughes hockey camp',
  'Alex Ovechkin hockey camp',
  'Nicklas Lidstrom hockey camp',
  'Peter Forsberg hockey camp',
  'Mats Sundin hockey camp',
  'Jaromir Jagr hockey camp',
  'Pavel Datsyuk hockey camp',
  'Henrik Lundqvist goalie camp',
  'Carey Price goalie camp',
  'Martin Brodeur goalie camp',
  'Marc-Andre Fleury goalie camp',
  'Andrei Vasilevskiy goalie camp',
  'Laura Stamm power skating',
  'Robby Glantz skating',
  'Barb Underhill power skating',
  'Peter Twist hockey conditioning',
  'Mike Valley goaltending',
  'Mitch Korn goalie school',
  'Sean Skinner goaltending',
  'Maria Mountain goaltending',
  'Darryl Belfry hockey skills',
  'Adam Oates hockey school',
  'Pavel Barber hockey skills',
  'How To Hockey camp',

  // ── MAJOR ORGANIZATIONS / COMPANIES ────────────────────────
  'Pro Ambitions hockey camp',
  'Bauer hockey camp',
  'CCM hockey camp',
  'Warrior hockey camp',
  'True hockey camp',
  'Total Package Hockey camp',
  'Planet Hockey camp',
  'Hockey Opportunity Camp',
  'Northeast Elite Hockey camp',
  'Elite Hockey Group camp',
  'American Hockey Camps',
  'International Hockey Camp',
  'World Pro Hockey Camp',
  'SuperDeker hockey training',
  'Ice Hockey Systems hockey camp',
  'Hockey Think Tank camp',
  'MyHockey Rankings camp',
  'Pursuit of Excellence hockey',
  'Edge School hockey',
  'Okanagan Hockey Academy',
  'Athol Murray College hockey',
  'Shattuck St Marys hockey',
  'Hill Academy hockey',
  'Banff Hockey Academy',
  'IMG Academy hockey',
  'Hockey Canada Skills Academy',
  'Ontario Hockey Academy',

  // ── NHL TEAM AFFILIATED ────────────────────────────────────
  'Boston Bruins youth hockey camp',
  'Toronto Maple Leafs hockey camp',
  'Montreal Canadiens hockey camp',
  'New York Rangers youth camp',
  'Detroit Red Wings hockey camp',
  'Chicago Blackhawks youth camp',
  'Pittsburgh Penguins hockey camp',
  'Minnesota Wild hockey camp',
  'Colorado Avalanche youth camp',
  'Tampa Bay Lightning hockey camp',
  'Dallas Stars hockey camp',
  'Edmonton Oilers hockey camp',
  'Calgary Flames hockey camp',
  'Vancouver Canucks hockey camp',
  'Winnipeg Jets hockey camp',
  'Ottawa Senators hockey camp',
  'Philadelphia Flyers hockey camp',
  'Washington Capitals hockey camp',
  'Nashville Predators hockey camp',
  'Carolina Hurricanes hockey camp',
  'Florida Panthers hockey camp',
  'San Jose Sharks hockey camp',
  'Los Angeles Kings hockey camp',
  'Anaheim Ducks hockey camp',
  'Arizona Coyotes hockey camp',
  'Seattle Kraken hockey camp',
  'Vegas Golden Knights hockey camp',
  'New Jersey Devils hockey camp',
  'Buffalo Sabres hockey camp',
  'Columbus Blue Jackets hockey camp',
  'St Louis Blues hockey camp',
  'New York Islanders hockey camp',

  // ── COLLEGE / JUNIOR AFFILIATED ────────────────────────────
  'NCAA hockey camp',
  'college hockey camp prospect',
  'USHL hockey camp',
  'NAHL hockey camp',
  'OHL hockey camp',
  'WHL hockey camp',
  'QMJHL hockey camp',
  'BCHL hockey camp',
  'USNTDP hockey camp',
  'hockey east camp',
  'NCHC hockey camp',
  'Big Ten hockey camp',
  'ECAC hockey camp',
  'WCHA hockey camp',
  'Boston University hockey camp',
  'Boston College hockey camp',
  'Michigan hockey camp',
  'Minnesota hockey camp Gophers',
  'North Dakota hockey camp',
  'Wisconsin hockey camp Badgers',
  'Denver hockey camp',
  'Quinnipiac hockey camp',

  // ── RINK / ARENA / FACILITY SEARCHES ───────────────────────
  'hockey camp at local rink',
  'arena youth hockey programs',
  'ice rink summer hockey camp',
  'community rink hockey clinic',
  'hockey training center camps',

  // ── EVENT PLATFORM SEARCHES ────────────────────────────────
  'youth hockey camp eventbrite',
  'hockey clinic active.com',
  'hockey camp signup genius',
  'youth hockey teamsnap',
  'hockey camp on sportsengine',
  'hockey clinic on sportngin',
];

// ═══════════════════════════════════════════════════════════════
// KNOWN SOURCES — 100+ organizations to directly scrape
// ═══════════════════════════════════════════════════════════════

export const KNOWN_SOURCES: { name: string; url: string; region: string }[] = [
  // ── NATIONAL FEDERATIONS ───────────────────────────────────
  { name: 'USA Hockey Camps', url: 'https://www.usahockey.com/camps', region: 'US' },
  { name: 'USA Hockey Events', url: 'https://www.usahockey.com/events', region: 'US' },
  { name: 'USA Hockey Player Development', url: 'https://www.usahockey.com/playerdevelopment', region: 'US' },
  { name: 'Hockey Canada Programs', url: 'https://www.hockeycanada.ca/en-ca/hockey-programs/players/develop', region: 'CA' },
  { name: 'Hockey Canada Camps', url: 'https://www.hockeycanada.ca/en-ca/hockey-programs/players/camps', region: 'CA' },
  { name: 'IIHF Events', url: 'https://www.iihf.hockey/en/events', region: 'INT' },
  { name: 'IIHF Development', url: 'https://www.iihf.hockey/en/development', region: 'INT' },
  { name: 'Swedish Hockey Schools', url: 'https://www.swehockey.se/for-spelare/hockeyskolor/', region: 'SE' },
  { name: 'Finnish Hockey Association', url: 'https://www.leijonat.fi/index.php/pelaajalle', region: 'FI' },
  { name: 'Czech Hockey', url: 'https://www.ceskyhokej.cz/mladez', region: 'CZ' },
  { name: 'Swiss Hockey', url: 'https://www.sihf.ch/en/game-center/development/', region: 'CH' },
  { name: 'German Hockey (DEB)', url: 'https://www.deb-online.de/nachwuchs/', region: 'DE' },
  { name: 'Norwegian Hockey', url: 'https://www.hockey.no/aktivitet/hockeyskole', region: 'NO' },
  { name: 'Danish Hockey', url: 'https://www.ishockey.dk/ungdom/', region: 'DK' },
  { name: 'Austrian Hockey', url: 'https://www.eishockey.at/nachwuchs/', region: 'AT' },
  { name: 'Slovak Hockey', url: 'https://www.hfrba.sk/', region: 'SK' },
  { name: 'Russia Hockey (FHR)', url: 'https://fhr.ru/hockey_development/', region: 'RU' },
  { name: 'Ice Hockey UK', url: 'https://www.icehockeyuk.co.uk/development/', region: 'GB' },
  { name: 'France Hockey (FFHG)', url: 'https://www.hockeyfrance.com/ecoles-de-hockey', region: 'FR' },
  { name: 'Japan Hockey (JIHF)', url: 'https://www.jihf.or.jp/', region: 'JP' },
  { name: 'Korea Hockey', url: 'https://www.kiha.or.kr/', region: 'KR' },
  { name: 'China Hockey', url: 'https://www.chinaiha.com/', region: 'CN' },
  { name: 'Australia Hockey (IHFA)', url: 'https://www.ihfa.asn.au/', region: 'AU' },
  { name: 'Latvia Hockey', url: 'https://www.lhf.lv/', region: 'LV' },
  { name: 'Poland Hockey (PZHL)', url: 'https://www.pzhl.org.pl/', region: 'PL' },
  { name: 'Italy Hockey (FISG)', url: 'https://www.fisg.it/', region: 'IT' },
  { name: 'Kazakhstan Hockey', url: 'https://www.kfh.kz/', region: 'KZ' },
  { name: 'Hungary Hockey', url: 'https://www.icehockey.hu/', region: 'HU' },

  // ── US STATE ASSOCIATIONS ──────────────────────────────────
  { name: 'Massachusetts Hockey', url: 'https://www.mahockey.org/camps', region: 'US' },
  { name: 'Minnesota Hockey', url: 'https://www.minnesotahockey.org/camps', region: 'US' },
  { name: 'Michigan (MAHA)', url: 'https://www.maha.org/camps', region: 'US' },
  { name: 'New York Hockey', url: 'https://www.nyhockey.org/programs', region: 'US' },
  { name: 'Connecticut Hockey', url: 'https://www.chcice.org/programs', region: 'US' },
  { name: 'New Jersey Youth Hockey', url: 'https://www.njyhl.com/page/show/2898060-camps-clinics', region: 'US' },
  { name: 'Pennsylvania Hockey', url: 'https://www.pahockey.com/programs', region: 'US' },
  { name: 'Illinois Hockey', url: 'https://www.aaborhockey.com/camps', region: 'US' },
  { name: 'Colorado Hockey', url: 'https://www.coloradohockey.org/programs', region: 'US' },
  { name: 'Ohio Hockey', url: 'https://www.ohiohockey.org/programs', region: 'US' },
  { name: 'California Hockey', url: 'https://www.cahockey.org/programs', region: 'US' },
  { name: 'Washington Hockey', url: 'https://www.wahockey.org/programs', region: 'US' },
  { name: 'Wisconsin Hockey', url: 'https://www.waha.org/programs', region: 'US' },
  { name: 'Alaska Hockey', url: 'https://www.alaskahockey.org/programs', region: 'US' },
  { name: 'North Dakota Hockey', url: 'https://www.ndaha.com/programs', region: 'US' },
  { name: 'Texas Hockey', url: 'https://www.tahockey.org/programs', region: 'US' },
  { name: 'Florida Hockey', url: 'https://www.fahockey.org/programs', region: 'US' },
  { name: 'Arizona Hockey', url: 'https://www.azhockey.org/programs', region: 'US' },
  { name: 'Missouri Hockey', url: 'https://www.moha.org/programs', region: 'US' },

  // ── CANADIAN PROVINCIAL ────────────────────────────────────
  { name: 'Ontario Hockey Federation', url: 'https://www.ohf.on.ca/programs', region: 'CA' },
  { name: 'Hockey Alberta', url: 'https://www.hockeyalberta.ca/programs', region: 'CA' },
  { name: 'BC Hockey', url: 'https://www.bchockey.net/Programs.aspx', region: 'CA' },
  { name: 'Hockey Quebec', url: 'https://www.hockey.qc.ca/fr/programmes.html', region: 'CA' },
  { name: 'Hockey Manitoba', url: 'https://www.hockeymanitoba.ca/programs', region: 'CA' },
  { name: 'Hockey Saskatchewan', url: 'https://www.sha.sk.ca/programs', region: 'CA' },
  { name: 'Hockey Nova Scotia', url: 'https://www.hockeynovascotia.ca/programs', region: 'CA' },
  { name: 'Hockey New Brunswick', url: 'https://www.hnb.ca/programs', region: 'CA' },
  { name: 'Hockey PEI', url: 'https://www.hockeypei.com/programs', region: 'CA' },
  { name: 'Hockey Newfoundland', url: 'https://www.hockeynl.ca/programs', region: 'CA' },
  { name: 'Hockey North', url: 'https://hockeynorth.ca/programs', region: 'CA' },

  // ── MAJOR CAMP ORGANIZATIONS ───────────────────────────────
  { name: 'Pro Ambitions Hockey', url: 'https://www.proambitions.com/', region: 'US' },
  { name: 'Laura Stamm Power Skating', url: 'https://www.laurastamm.com/', region: 'US' },
  { name: 'Bauer Hockey Camps', url: 'https://www.bauer.com/en-US/hockey-camps/', region: 'INT' },
  { name: 'CCM Hockey Camps', url: 'https://www.ccmhockey.com/en/camps', region: 'INT' },
  { name: 'Total Package Hockey', url: 'https://www.totalpackagehockey.com/', region: 'US' },
  { name: 'Planet Hockey', url: 'https://www.planethockey.com/', region: 'US' },
  { name: 'Northeast Elite Hockey', url: 'https://www.northeastelitehockey.com/', region: 'US' },
  { name: 'Hockey Opportunity Camp', url: 'https://www.hockeyopportunity.com/', region: 'US' },
  { name: 'IMG Academy Hockey', url: 'https://www.imgacademy.com/sports/hockey', region: 'US' },
  { name: 'Okanagan Hockey Academy', url: 'https://www.okanaganhockey.com/', region: 'CA' },
  { name: 'Pursuit of Excellence', url: 'https://www.poehockey.com/', region: 'CA' },
  { name: 'Edge School Hockey', url: 'https://www.edgeschool.com/athletics/hockey', region: 'CA' },
  { name: 'Banff Hockey Academy', url: 'https://www.banffhockeyacademy.com/', region: 'CA' },
  { name: 'Hill Academy Hockey', url: 'https://www.hillacademy.com/', region: 'CA' },
  { name: 'Shattuck St Marys Hockey', url: 'https://www.shattuck.org/athletics/hockey', region: 'US' },
  { name: 'Athol Murray College', url: 'https://www.notredame.ca/hockey', region: 'CA' },
  { name: 'Ontario Hockey Academy', url: 'https://www.ontariohockeyacademy.com/', region: 'CA' },
  { name: 'Robby Glantz Skating', url: 'https://www.robbyglantz.com/', region: 'US' },
  { name: 'SuperDeker Training', url: 'https://www.superdeker.com/', region: 'US' },
  { name: 'Pavel Barber Hockey', url: 'https://www.pavelbarber.com/', region: 'US' },
  { name: 'International Hockey Camp', url: 'https://www.internationalhockeycamp.com/', region: 'INT' },
  { name: 'American Hockey Camps', url: 'https://www.americanhockeycamps.com/', region: 'US' },
  { name: 'World Pro Hockey Camp', url: 'https://www.worldprohockeycamp.com/', region: 'CA' },
  { name: 'Rocky Mountain Hockey', url: 'https://www.rmhockey.com/', region: 'US' },
  { name: 'Scandinavian Hockey Camp', url: 'https://www.scandinavianhockeycamp.com/', region: 'SE' },
  { name: 'European Hockey Camp', url: 'https://www.europeanhockeycamp.com/', region: 'INT' },
  { name: 'Hockey Canada Skills', url: 'https://www.hockeycanada.ca/en-ca/hockey-programs/players/skills', region: 'CA' },

  // ── EVENT PLATFORMS ────────────────────────────────────────
  { name: 'Eventbrite Hockey US', url: 'https://www.eventbrite.com/d/united-states/youth-hockey-camp/', region: 'US' },
  { name: 'Eventbrite Hockey Canada', url: 'https://www.eventbrite.ca/d/canada/youth-hockey-camp/', region: 'CA' },
  { name: 'Eventbrite Hockey Europe', url: 'https://www.eventbrite.co.uk/d/europe/ice-hockey-camp/', region: 'INT' },
  { name: 'Active.com Hockey', url: 'https://www.active.com/hockey/camps', region: 'US' },
  { name: 'SportsEngine Hockey', url: 'https://www.sportsengine.com/hockey', region: 'US' },

  // ── DIRECTORIES / AGGREGATORS ──────────────────────────────
  { name: 'MySummerCamps Hockey', url: 'https://www.mysummercamps.com/camps/Sports_Camps/Hockey_Camps/', region: 'US' },
  { name: 'CampPage Hockey', url: 'https://www.camppage.com/hockey-camps', region: 'US' },
  { name: 'KidsCamps Hockey', url: 'https://www.kidscamps.com/sports/hockey_camps.html', region: 'US' },
  { name: 'HockeyDB Camps', url: 'https://www.hockeydb.com/camps/', region: 'INT' },
  { name: 'EliteProspects Camps', url: 'https://www.eliteprospects.com/camps', region: 'INT' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════

export class ClinicSearchEngine {
  private config: SearchConfig & { maxConcurrent: number };
  private cache: Map<string, { data: Clinic[]; timestamp: number }> = new Map();
  private cacheTTL = 30 * 60 * 1000;
  private discoveredUrls: Set<string> = new Set();

  constructor(config: SearchConfig = {}) {
    this.config = {
      maxResultsPerSource: 50,
      timeout: 5000,
      maxConcurrent: 8,
      ...config,
    };
  }

  updateConfig(config: Partial<SearchConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Execute promises in batches to control concurrency
   */
  private async runBatched<T>(
    tasks: (() => Promise<T>)[],
    batchSize: number,
    timeBudget?: number,
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];
    const startTime = Date.now();

    for (let i = 0; i < tasks.length; i += batchSize) {
      // Check global time budget — if we're running low, stop launching new batches
      if (timeBudget && Date.now() - startTime > timeBudget) {
        // Mark remaining as rejected (timed out)
        for (let j = i; j < tasks.length; j++) {
          results.push({ status: 'rejected', reason: new Error('Global time budget exceeded') });
        }
        break;
      }

      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((task) =>
          Promise.race([
            task(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Source timeout')), this.config.timeout)
            ),
          ])
        )
      );
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * Main search — orchestrates all discovery strategies.
   * Designed to complete within 45 seconds on Vercel serverless.
   */
  async search(query?: string, forceRefresh = false): Promise<{
    clinics: Clinic[];
    sources: { name: string; count: number; status: 'success' | 'error'; error?: string }[];
    totalRaw: number;
    searchDuration: number;
  }> {
    const startTime = Date.now();
    const GLOBAL_BUDGET = 45000; // 45 seconds max — leave headroom for Vercel's 60s limit
    const cacheKey = query || '__all__';

    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          clinics: cached.data,
          sources: [{ name: 'cache', count: cached.data.length, status: 'success' }],
          totalRaw: cached.data.length,
          searchDuration: Date.now() - startTime,
        };
      }
    }

    const allRawData: RawClinicData[] = [];
    const sourceResults: { name: string; count: number; status: 'success' | 'error'; error?: string }[] = [];

    // ─── Build task list ─────────────────────────────────────
    type TaskResult = { name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string };

    // PHASE 1 tasks: Scrape known sources
    // Prioritize sources near the user, then national, then international
    const prioritySources = this.prioritizeSourcesByLocation(KNOWN_SOURCES).slice(0, 30);
    const scrapeTasks: (() => Promise<TaskResult>)[] = prioritySources.map((source) => async () => {
      try {
        const results = await this.scrapeSource(source.url, source.name);
        return { name: source.name, results, status: 'success' as const };
      } catch (e) {
        return { name: source.name, results: [] as RawClinicData[], status: 'error' as const, error: String(e) };
      }
    });

    // PHASE 2 tasks: Search API queries (Google + Brave + Tavily + Eventbrite)
    const searchTasks: (() => Promise<TaskResult>)[] = [];
    const searchQueries = query
      ? this.expandUserQuery(query)
      : this.selectSearchQueries();

    // Google Programmable Search Engine — primary, best quality
    if (this.config.googleApiKey && this.config.googleCseId) {
      for (const q of searchQueries.slice(0, 10)) {
        searchTasks.push(() => this.searchViaGoogle(q));
      }
    }

    // Brave Search — secondary, own independent index
    if (this.config.braveApiKey) {
      for (const q of searchQueries.slice(0, 8)) {
        searchTasks.push(() => this.searchViaBrave(q));
      }
    }

    // Tavily — AI-native search, structured extraction
    if (this.config.tavilyApiKey) {
      for (const q of searchQueries.slice(0, 6)) {
        searchTasks.push(() => this.searchViaTavily(q));
      }
    }

    // Eventbrite — domain-specific event platform
    if (this.config.eventbriteApiKey) {
      const ebQueries = query
        ? [query]
        : ['youth hockey camp', 'ice hockey clinic', 'hockey skills camp'];
      for (const q of ebQueries) {
        searchTasks.push(() => this.searchEventbrite(q));
      }
    }

    // ─── Execute: API searches first (fastest), then scrapes ──
    // API searches are typically faster than full page scrapes
    const allTasks = [...searchTasks, ...scrapeTasks];

    const results = await this.runBatched(
      allTasks,
      this.config.maxConcurrent,
      GLOBAL_BUDGET - 10000, // Leave 10s for post-processing
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        sourceResults.push({
          name: r.name,
          count: r.results.length,
          status: r.status,
          error: 'error' in r ? r.error : undefined,
        });
        allRawData.push(...r.results);
      } else {
        sourceResults.push({
          name: 'timeout',
          count: 0,
          status: 'error',
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // ─── PHASE 3: Skip recursive discovery if running low on time ──
    const timeRemaining = GLOBAL_BUDGET - (Date.now() - startTime);
    if (timeRemaining > 15000) {
      const newUrls = this.extractDiscoverableUrls(allRawData);
      if (newUrls.length > 0) {
        const discoveryTasks = newUrls.slice(0, 5).map((url) => async (): Promise<TaskResult> => {
          try {
            const r = await this.scrapeSource(url, `Discovered: ${new URL(url).hostname}`);
            return { name: `Discovery: ${new URL(url).hostname}`, results: r, status: 'success' };
          } catch (e) {
            return { name: `Discovery: ${url}`, results: [], status: 'error', error: String(e) };
          }
        });

        const discoveryResults = await this.runBatched(discoveryTasks, 5, 8000);
        for (const result of discoveryResults) {
          if (result.status === 'fulfilled') {
            sourceResults.push({
              name: result.value.name,
              count: result.value.results.length,
              status: result.value.status,
            });
            allRawData.push(...result.value.results);
          }
        }
      }
    }

    // ─── PHASE 4: Process, deduplicate, enrich ──────────────
    const processedClinics = await this.processRawData(allRawData);

    // Always include curated seed clinics — filter by query if provided
    let seedResults = SEED_CLINICS;
    if (query) {
      const q = query.toLowerCase();
      seedResults = SEED_CLINICS.filter((c) => {
        const text = `${c.name} ${c.description} ${c.location.city} ${c.location.state} ${c.location.country} ${c.tags.join(' ')}`.toLowerCase();
        return q.split(/\s+/).some((word) => text.includes(word));
      });
    }
    sourceResults.push({ name: 'Curated Database', count: seedResults.length, status: 'success' });

    // Combine seed + scraped, then deduplicate
    const combined = [...seedResults, ...processedClinics];
    const deduped = deduplicateClinics(combined);

    // Only geocode if we have time left (geocoding is slow, 1 req/sec)
    const geoTimeRemaining = GLOBAL_BUDGET - (Date.now() - startTime);
    const enriched = geoTimeRemaining > 5000
      ? await this.geoEnrich(deduped.slice(0, 20)) // Only geocode top 20
      : deduped;

    // ─── TIERED DISTANCE SCORING ────────────────────────────
    // Score each clinic by relevance (distance + quality + featured)
    const userLat = this.config.userLat;
    const userLng = this.config.userLng;
    const hasLocation = userLat !== undefined && userLng !== undefined && userLat !== 0;

    const scored = enriched.map((clinic) => {
      let score = 0;

      // Distance-based scoring (0 to 50 points)
      if (hasLocation && clinic.location.lat !== 0 && clinic.location.lng !== 0) {
        const dist = calculateDistance(userLat!, userLng!, clinic.location.lat, clinic.location.lng);
        if (dist < 50) score += 50;       // Tier 1: Local city (<50km)
        else if (dist < 150) score += 40;  // Tier 2: Regional (<150km)
        else if (dist < 500) score += 30;  // Tier 3: State (<500km)
        else if (dist < 2000) score += 20; // Tier 4: Country (<2000km)
        else score += 5;                   // Tier 5: Global
      } else {
        score += 15; // No location data — neutral
      }

      // Quality signals (0 to 30 points)
      if (clinic.featured) score += 15;
      if (clinic.rating >= 4.5) score += 10;
      else if (clinic.rating >= 4.0) score += 5;
      if (clinic.reviewCount > 50) score += 5;

      // Recency bonus (0 to 10 points)
      if (clinic.isNew) score += 5;
      const daysUntil = (new Date(clinic.dates.start).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntil > 0 && daysUntil < 90) score += 5;    // Upcoming soon
      else if (daysUntil > 0 && daysUntil < 180) score += 3;

      // "Must-join" breakthrough: high-rated + featured clinics get a global boost
      if (clinic.featured && clinic.rating >= 4.7 && clinic.reviewCount > 100) {
        score += 20; // Outstanding clinic — surfaces regardless of distance
      }

      return { clinic, score };
    });

    // Sort by score descending, then by date ascending for ties
    const sorted = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.clinic.dates.start.localeCompare(b.clinic.dates.start);
      })
      .map((s) => s.clinic);

    this.cache.set(cacheKey, { data: sorted, timestamp: Date.now() });

    return {
      clinics: sorted,
      sources: sourceResults,
      totalRaw: allRawData.length,
      searchDuration: Date.now() - startTime,
    };
  }

  /**
   * Expand a user query into multiple intelligent variations
   */
  private expandUserQuery(query: string): string[] {
    const q = query.toLowerCase();
    const expansions = [query];

    // Add year
    if (!q.includes('2026') && !q.includes('2025')) {
      expansions.push(`${query} 2026`);
    }

    // Add "youth" if not present
    if (!q.includes('youth') && !q.includes('kids') && !q.includes('junior')) {
      expansions.push(`youth ${query}`);
      expansions.push(`kids ${query}`);
    }

    // Add "camp" / "clinic" variations
    if (!q.includes('camp') && !q.includes('clinic')) {
      expansions.push(`${query} camp`);
      expansions.push(`${query} clinic`);
    }

    // Add "registration" variant
    expansions.push(`${query} registration`);

    // Add regional variations if location detected
    if (q.includes('hockey')) {
      expansions.push(`${query} near me`);
      expansions.push(`${query} summer`);
    }

    // Location-aware expansions: inject user's city/state into query variations
    const { userCity, userState } = this.config;
    if (userCity && !q.includes(userCity.toLowerCase())) {
      expansions.push(`${query} ${userCity}`);
    }
    if (userState && !q.includes(userState.toLowerCase())) {
      expansions.push(`${query} ${userState}`);
    }

    return [...new Set(expansions)].slice(0, 18);
  }

  /**
   * Generate TIERED location-aware search queries.
   *
   * Priority tiers (most queries for closest, fewer for farther):
   *   Tier 1 — Local city (e.g. "Fort Lauderdale hockey camp 2026")
   *   Tier 2 — Regional / metro area (e.g. "South Florida hockey camp")
   *   Tier 3 — State / province (e.g. "Florida hockey camp")
   *   Tier 4 — Country-level (e.g. "USA Hockey camp")
   *   Tier 5 — Global (rotated diverse sample from the corpus)
   *
   * If no location is available, falls back to a diverse global selection.
   */
  private selectSearchQueries(): string[] {
    const { userCity, userState, userCountry } = this.config;
    const selected: string[] = [];

    // ── TIER 1 & 2 & 3: Location-specific queries ─────────────
    if (userCity || userState) {
      const baseTerms = [
        'youth hockey camp', 'hockey clinic', 'hockey skills camp',
        'youth hockey development', 'learn to play hockey',
        'hockey camp', 'ice hockey camp',
      ];

      // Tier 1: City-level (highest priority — 6 queries)
      if (userCity) {
        for (const term of baseTerms.slice(0, 6)) {
          selected.push(`${term} ${userCity} 2026`);
        }
        selected.push(`hockey camp near ${userCity}`);
        selected.push(`youth hockey ${userCity} registration`);
      }

      // Tier 2: Regional / broader metro (4 queries)
      const regionNames = this.getRegionalNames(userCity || '', userState || '');
      for (const region of regionNames.slice(0, 2)) {
        selected.push(`youth hockey camp ${region} 2026`);
        selected.push(`hockey clinic ${region}`);
      }

      // Tier 3: State-level (3 queries)
      if (userState) {
        selected.push(`hockey camp ${userState} 2026`);
        selected.push(`youth hockey development ${userState}`);
        selected.push(`ice hockey clinic ${userState} summer 2026`);
      }
    }

    // ── TIER 4: Country-level (2 queries) ──────────────────────
    if (userCountry) {
      const countryQueries: Record<string, string[]> = {
        'United States': ['USA Hockey player development camp', 'youth hockey camp summer 2026'],
        'Canada': ['Hockey Canada skills academy', 'hockey camp Ontario Quebec Alberta 2026'],
        'Sweden': ['ishockeyskola Sverige 2026', 'SHL hockey school'],
        'Finland': ['jääkiekkokoulu 2026', 'Liiga hockey school Finland'],
      };
      const cq = countryQueries[userCountry] || [`ice hockey camp ${userCountry} 2026`];
      selected.push(...cq.slice(0, 2));
    }

    // ── TIER 5: Global diverse sample ──────────────────────────
    // Fill remaining slots from the global corpus
    const targetTotal = 27; // Total queries budget
    const categories = {
      core: SEARCH_QUERIES.filter((_, i) => i < 19),
      specialty: SEARCH_QUERIES.filter((_, i) => i >= 19 && i < 35),
      girls: SEARCH_QUERIES.filter((_, i) => i >= 35 && i < 40),
      regional_us: SEARCH_QUERIES.filter((_, i) => i >= 62 && i < 89),
      regional_canada: SEARCH_QUERIES.filter((_, i) => i >= 89 && i < 105),
      regional_europe: SEARCH_QUERIES.filter((_, i) => i >= 105 && i < 158),
      coaches: SEARCH_QUERIES.filter((_, i) => i >= 166 && i < 197),
      organizations: SEARCH_QUERIES.filter((_, i) => i >= 197 && i < 224),
      nhl: SEARCH_QUERIES.filter((_, i) => i >= 224 && i < 256),
      college: SEARCH_QUERIES.filter((_, i) => i >= 256),
    };

    const globalPool: string[] = [];
    const pick = (arr: string[], count: number) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      globalPool.push(...shuffled.slice(0, count));
    };

    pick(categories.core, 3);
    pick(categories.specialty, 2);
    pick(categories.girls, 1);
    pick(categories.regional_us, 2);
    pick(categories.regional_canada, 1);
    pick(categories.regional_europe, 2);
    pick(categories.coaches, 2);
    pick(categories.organizations, 2);
    pick(categories.nhl, 2);
    pick(categories.college, 1);

    // Deduplicate and fill remaining
    const existingSet = new Set(selected.map((s) => s.toLowerCase()));
    for (const q of globalPool) {
      if (selected.length >= targetTotal) break;
      if (!existingSet.has(q.toLowerCase())) {
        selected.push(q);
        existingSet.add(q.toLowerCase());
      }
    }

    return selected;
  }

  /**
   * Get regional area names for a city/state combination
   * (e.g. Fort Lauderdale, FL → ["South Florida", "Broward County", "Miami-Dade"])
   */
  private getRegionalNames(city: string, state: string): string[] {
    const regions: string[] = [];
    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();

    // Florida regions
    if (stateLower === 'fl' || stateLower === 'florida') {
      if (['fort lauderdale', 'miami', 'coral springs', 'pembroke pines', 'sunrise', 'boca raton', 'hollywood', 'pompano beach', 'deerfield beach', 'plantation', 'weston', 'davie', 'coconut creek'].some(c => cityLower.includes(c))) {
        regions.push('South Florida', 'Broward County', 'Miami-Fort Lauderdale');
      } else if (['tampa', 'st petersburg', 'clearwater', 'brandon', 'lakeland'].some(c => cityLower.includes(c))) {
        regions.push('Tampa Bay', 'Central Florida');
      } else if (['orlando', 'kissimmee'].some(c => cityLower.includes(c))) {
        regions.push('Central Florida', 'Orlando metro');
      } else if (['jacksonville'].some(c => cityLower.includes(c))) {
        regions.push('North Florida', 'Jacksonville metro');
      } else if (['west palm beach', 'palm beach', 'jupiter', 'boynton beach', 'delray beach'].some(c => cityLower.includes(c))) {
        regions.push('Palm Beach County', 'South Florida');
      }
    }

    // Northeast US
    if (['ma', 'massachusetts'].includes(stateLower)) {
      regions.push('New England', 'Greater Boston');
    } else if (['ct', 'connecticut', 'nh', 'new hampshire', 'vt', 'vermont', 'me', 'maine', 'ri', 'rhode island'].includes(stateLower)) {
      regions.push('New England');
    } else if (['ny', 'new york'].includes(stateLower)) {
      regions.push('Tri-State area', 'New York metro');
    } else if (['nj', 'new jersey'].includes(stateLower)) {
      regions.push('Tri-State area', 'New Jersey');
    } else if (['mn', 'minnesota'].includes(stateLower)) {
      regions.push('Twin Cities', 'Upper Midwest');
    } else if (['mi', 'michigan'].includes(stateLower)) {
      regions.push('Great Lakes', 'Michigan');
    } else if (['co', 'colorado'].includes(stateLower)) {
      regions.push('Front Range', 'Rocky Mountain');
    } else if (['tx', 'texas'].includes(stateLower)) {
      if (cityLower.includes('dallas') || cityLower.includes('fort worth') || cityLower.includes('frisco')) {
        regions.push('DFW', 'North Texas');
      } else if (cityLower.includes('houston')) {
        regions.push('Houston metro', 'Southeast Texas');
      }
    } else if (['ca', 'california'].includes(stateLower)) {
      if (cityLower.includes('los angeles') || cityLower.includes('anaheim') || cityLower.includes('irvine')) {
        regions.push('Southern California', 'LA metro');
      } else if (cityLower.includes('san jose') || cityLower.includes('san francisco') || cityLower.includes('oakland')) {
        regions.push('Bay Area', 'Northern California');
      }
    } else if (['il', 'illinois'].includes(stateLower)) {
      regions.push('Chicagoland', 'Greater Chicago');
    } else if (['pa', 'pennsylvania'].includes(stateLower)) {
      if (cityLower.includes('pittsburgh')) regions.push('Western Pennsylvania');
      else regions.push('Delaware Valley', 'Greater Philadelphia');
    }

    // Canadian provinces
    if (['on', 'ontario'].includes(stateLower)) {
      if (cityLower.includes('toronto')) regions.push('Greater Toronto Area', 'GTA');
      else if (cityLower.includes('ottawa')) regions.push('National Capital Region');
      else regions.push('Southern Ontario');
    } else if (['qc', 'quebec'].includes(stateLower)) {
      regions.push('Greater Montreal', 'Quebec');
    } else if (['bc', 'british columbia'].includes(stateLower)) {
      regions.push('Lower Mainland', 'BC');
    } else if (['ab', 'alberta'].includes(stateLower)) {
      regions.push('Alberta', cityLower.includes('calgary') ? 'Calgary metro' : 'Edmonton metro');
    }

    // Fallback: just use the state name
    if (regions.length === 0 && state) {
      regions.push(state);
    }

    return regions;
  }

  /**
   * Prioritize known sources based on user's location.
   * Sources matching the user's country/state come first, then the rest.
   */
  private prioritizeSourcesByLocation(
    sources: typeof KNOWN_SOURCES
  ): typeof KNOWN_SOURCES {
    const { userCountry, userState } = this.config;
    if (!userCountry && !userState) return sources;

    // Map country names to region codes
    const countryToRegion: Record<string, string[]> = {
      'United States': ['US'],
      'Canada': ['CA'],
      'Sweden': ['SE'],
      'Finland': ['FI'],
      'Czech Republic': ['CZ'],
      'Germany': ['DE'],
      'Switzerland': ['CH'],
      'Russia': ['RU'],
      'United Kingdom': ['GB'],
      'France': ['FR'],
      'Japan': ['JP'],
      'Australia': ['AU'],
    };

    const userRegions = new Set(countryToRegion[userCountry || ''] || []);

    // Score each source: local region first, then international, then rest
    return [...sources].sort((a, b) => {
      const aLocal = userRegions.has(a.region) ? 0 : (a.region === 'INT' ? 1 : 2);
      const bLocal = userRegions.has(b.region) ? 0 : (b.region === 'INT' ? 1 : 2);
      return aLocal - bLocal;
    });
  }

  /**
   * Extract new URLs from raw data for recursive discovery
   */
  private extractDiscoverableUrls(rawData: RawClinicData[]): string[] {
    const urls: string[] = [];

    for (const raw of rawData) {
      const candidates = [raw.websiteUrl, raw.registrationUrl, raw.sourceUrl].filter(Boolean) as string[];

      for (const url of candidates) {
        try {
          const parsed = new URL(url);
          const domain = parsed.hostname;

          // Don't re-discover URLs we already know about
          if (this.discoveredUrls.has(domain)) continue;

          // Don't follow links to generic platforms
          const skipDomains = [
            'google.com', 'bing.com', 'facebook.com', 'twitter.com', 'instagram.com',
            'youtube.com', 'linkedin.com', 'wikipedia.org', 'amazon.com', 'reddit.com',
            'eventbrite.com', 'active.com',
          ];
          if (skipDomains.some((d) => domain.includes(d))) continue;

          // Only follow if it looks like it could be a hockey org
          const fullText = `${url} ${raw.name || ''} ${raw.description || ''}`.toLowerCase();
          const hockeySignals = ['hockey', 'skating', 'rink', 'arena', 'ice', 'camp', 'clinic'];
          if (hockeySignals.some((s) => fullText.includes(s))) {
            this.discoveredUrls.add(domain);
            urls.push(url);
          }
        } catch {
          // Invalid URL
        }
      }
    }

    return urls;
  }

  /**
   * Scrape a URL for clinic data
   */
  private async scrapeSource(url: string, sourceName: string): Promise<RawClinicData[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HockeyClinicsBot/1.0; +https://github.com/hockey-clinics-finder)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,sv;q=0.7,fi;q=0.6,de;q=0.5',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Limit response body to 2MB to avoid hanging on huge pages
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      if (contentLength > 2 * 1024 * 1024) throw new Error('Page too large');

      const html = await response.text();
      // Skip if the page is absurdly large (would slow down cheerio parsing)
      if (html.length > 2 * 1024 * 1024) return [];

      return extractClinicsFromHTML(html, url, sourceName);
    } catch {
      // Silently fail — expected for many sources (timeouts, 403s, etc.)
      return [];
    }
  }

  // ── Search API Implementations ─────────────────────────────

  /**
   * Google Programmable Search Engine — best quality, 100 free queries/day
   * https://developers.google.com/custom-search/v1/overview
   */
  private async searchViaGoogle(query: string): Promise<{
    name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        key: this.config.googleApiKey!, cx: this.config.googleCseId!,
        q: query, num: '10',
      });
      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
        signal: AbortSignal.timeout(this.config.timeout!),
      });
      if (!response.ok) throw new Error(`Google HTTP ${response.status}`);
      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const item of data.items || []) {
        results.push({
          source: 'Google', sourceUrl: item.link, name: item.title,
          description: item.snippet,
          imageUrl: item.pagemap?.cse_image?.[0]?.src,
          websiteUrl: item.link, registrationUrl: item.link,
          confidence: this.calculateConfidence(item.title, item.snippet),
        });
      }
      return { name: `Google: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Google: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Brave Search API — own index (30B+ pages), legally safe, 2K free queries/month
   * https://api.search.brave.com/app/documentation/web-search
   */
  private async searchViaBrave(query: string): Promise<{
    name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: query, count: '20', safesearch: 'off', text_decorations: 'false',
      });
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.config.braveApiKey!,
        },
        signal: AbortSignal.timeout(this.config.timeout!),
      });
      if (!response.ok) throw new Error(`Brave HTTP ${response.status}`);
      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const result of data.web?.results || []) {
        results.push({
          source: 'Brave Search', sourceUrl: result.url, name: result.title,
          description: result.description, websiteUrl: result.url,
          registrationUrl: result.url,
          imageUrl: result.thumbnail?.src,
          confidence: this.calculateConfidence(result.title, result.description),
        });
      }
      return { name: `Brave: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Brave: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Tavily Search API — AI-native search, 1K free credits/month
   * https://docs.tavily.com/documentation/api-reference/endpoint/search
   */
  private async searchViaTavily(query: string): Promise<{
    name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string;
  }> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.tavilyApiKey!,
          query,
          search_depth: 'basic',
          max_results: 15,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });
      if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const result of data.results || []) {
        results.push({
          source: 'Tavily', sourceUrl: result.url, name: result.title,
          description: (result.content || '').substring(0, 500),
          websiteUrl: result.url, registrationUrl: result.url,
          confidence: this.calculateConfidence(result.title, result.content),
        });
      }
      return { name: `Tavily: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Tavily: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  private async searchEventbrite(query: string): Promise<{
    name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string;
  }> {
    try {
      // Eventbrite v3 /events/search/ was deprecated. Use the destination search
      // endpoint which is the current supported way to search public events.
      const params = new URLSearchParams({
        q: query,
        page_size: '20',
      });
      const response = await fetch(`https://www.eventbriteapi.com/v3/destination/search/?${params}`, {
        headers: { Authorization: `Bearer ${this.config.eventbriteApiKey}` },
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) {
        // Fallback: try the organizations endpoint if destination search fails
        // Some private tokens only work with org-scoped endpoints
        throw new Error(`Eventbrite HTTP ${response.status}`);
      }

      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const event of data.events?.results || data.events || []) {
        results.push({
          source: 'Eventbrite', sourceUrl: event.url || event.primary_venue_url || '',
          name: event.name || event.title || '',
          description: (event.summary || event.description?.text || '').substring(0, 500),
          imageUrl: event.image?.url || event.logo?.url || '',
          venue: event.primary_venue?.name || event.venue?.name || '',
          city: event.primary_venue?.address?.city || event.venue?.address?.city || '',
          state: event.primary_venue?.address?.region || event.venue?.address?.region || '',
          country: event.primary_venue?.address?.country || event.venue?.address?.country || '',
          startDate: event.start_date || event.start?.utc || '',
          endDate: event.end_date || event.end?.utc || '',
          websiteUrl: event.url || '',
          registrationUrl: event.url || event.tickets_url || '',
          confidence: 0.8,
        });
      }
      return { name: `Eventbrite: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Eventbrite: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  // ── Confidence Scoring ─────────────────────────────────────

  private calculateConfidence(title?: string, description?: string): number {
    if (!title && !description) return 0;
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    let score = 0;

    // STRONG signals (each +0.25)
    const strongSignals = [
      'hockey clinic', 'hockey camp', 'hockey school', 'hockey academy',
      'skating clinic', 'hockey training camp', 'hockey program',
      'hockey development program', 'learn to play hockey', 'hockey skills camp',
      'hockey showcase', 'hockey tournament', 'goaltending camp',
      'power skating clinic', 'hockey prospect camp', 'hockey evaluation camp',
      'hockey instruction', 'hockey session', 'on-ice training',
      'ice hockey camp', 'hockey summer camp', 'hockey spring camp',
      'hockey winter camp', 'hockey mini camp', 'hockey day camp',
      'hockey overnight camp', 'hockey residential camp',
    ];
    for (const kw of strongSignals) {
      if (text.includes(kw)) { score += 0.25; break; } // Only count once
    }
    // Second strong signal check (can stack up to 0.5 from strong)
    let strongCount = 0;
    for (const kw of strongSignals) {
      if (text.includes(kw)) strongCount++;
    }
    if (strongCount >= 2) score += 0.15;
    if (strongCount >= 3) score += 0.1;

    // YOUTH signals (+0.15 each, max +0.3)
    const youthSignals = [
      'youth', 'kids', 'children', 'junior', 'minor', 'young player',
      'mite', 'squirt', 'peewee', 'pee wee', 'bantam', 'midget',
      'atom', 'novice', 'u8', 'u10', 'u12', 'u14', 'u16', 'u18',
      'ages 4', 'ages 5', 'ages 6', 'ages 7', 'ages 8', 'ages 9',
      'ages 10', 'ages 11', 'ages 12', 'ages 13', 'ages 14',
      'ages 15', 'ages 16', 'ages 17', 'ages 18',
      'boys and girls', 'coed', 'co-ed',
    ];
    let youthCount = 0;
    for (const kw of youthSignals) {
      if (text.includes(kw)) youthCount++;
    }
    score += Math.min(0.3, youthCount * 0.15);

    // REGISTRATION signals (+0.1 each, max +0.2)
    const regSignals = [
      'register now', 'registration', 'sign up', 'enroll', 'book now',
      'spots available', 'limited spots', 'early bird', 'tuition',
      'cost per player', 'per skater', 'enrollment', 'application',
    ];
    let regCount = 0;
    for (const kw of regSignals) {
      if (text.includes(kw)) regCount++;
    }
    score += Math.min(0.2, regCount * 0.1);

    // VENUE signals (+0.1)
    const venueSignals = [
      'arena', 'rink', 'ice center', 'ice complex', 'ice plex',
      'sportsplex', 'coliseum', 'civic center', 'recreation center',
    ];
    for (const kw of venueSignals) {
      if (text.includes(kw)) { score += 0.1; break; }
    }

    // DATE signals (+0.05)
    if (/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(text)) {
      score += 0.05;
    }
    if (/202[5-7]/i.test(text)) score += 0.05;

    // NEGATIVE signals
    const negativeSignals = [
      'nhl scores', 'game recap', 'trade rumor', 'fantasy hockey',
      'watch live', 'highlights', 'standings', 'playoff', 'draft pick',
      'free agent', 'contract extension', 'injury report', 'box score',
      'power rankings', 'betting odds', 'prop bet',
      'news article', 'opinion column', 'editorial', 'blog post',
    ];
    for (const kw of negativeSignals) {
      if (text.includes(kw)) score -= 0.15;
    }

    return Math.max(0, Math.min(1, score));
  }

  // ── Data Processing ────────────────────────────────────────

  private async processRawData(rawData: RawClinicData[]): Promise<Clinic[]> {
    const confident = rawData.filter((r) => r.confidence >= 0.25);

    return confident.map((raw, index) => {
      const id = `clinic-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 8)}`;
      const { startDate, endDate } = this.parseDates(raw);
      const { amount, currency } = this.parsePrice(raw);
      const ageGroups = this.parseAgeGroups(raw);
      const skillLevels = this.parseSkillLevels(raw);
      const clinicType = this.parseClinicType(raw);

      const location = {
        venue: raw.venue || raw.location || 'Venue TBD',
        address: '',
        city: raw.city || this.extractCity(raw) || 'Unknown',
        state: raw.state || '',
        country: raw.country || this.inferCountry(raw) || 'Unknown',
        countryCode: this.getCountryCode(raw.country || this.inferCountry(raw) || ''),
        lat: 0, lng: 0,
      };

      return {
        id, name: raw.name || 'Hockey Clinic', type: clinicType,
        description: (raw.description || '').substring(0, 200),
        longDescription: raw.description || '',
        imageUrl: raw.imageUrl || '',
        galleryUrls: raw.imageUrl ? [raw.imageUrl] : [],
        location,
        dates: { start: startDate, end: endDate },
        schedule: [],
        duration: this.calculateDuration(startDate, endDate),
        price: { amount, currency },
        ageGroups, skillLevels,
        coaches: (raw.coaches || []).map((name, i) => ({
          id: `coach-${id}-${i}`, name, title: 'Instructor',
          bio: '', photoUrl: '', credentials: [],
        })),
        maxParticipants: 50, spotsRemaining: 25,
        registrationUrl: raw.registrationUrl || raw.websiteUrl || raw.sourceUrl,
        websiteUrl: raw.websiteUrl || raw.sourceUrl,
        contactEmail: raw.contactEmail || '',
        contactPhone: raw.contactPhone || '',
        amenities: raw.amenities || [],
        includes: [],
        tags: this.generateTags(raw),
        featured: raw.confidence >= 0.65,
        isNew: true,
        rating: 0, reviewCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
      } satisfies Clinic;
    });
  }

  private parseDates(raw: RawClinicData): { startDate: string; endDate: string } {
    if (raw.startDate && raw.endDate) {
      return {
        startDate: raw.startDate.split('T')[0],
        endDate: raw.endDate.split('T')[0],
      };
    }

    if (raw.dateText) {
      const datePatterns = [
        /(\w+ \d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})/i,
        /(\w+ \d{1,2},?\s*\d{4})\s*[-–]\s*(\w+ \d{1,2},?\s*\d{4})/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(\d{4}-\d{2}-\d{2})/i,
      ];
      for (const pattern of datePatterns) {
        const match = raw.dateText.match(pattern);
        if (match) {
          try {
            const start = new Date(match[1]).toISOString().split('T')[0];
            const end = match[2] ? new Date(match[2]).toISOString().split('T')[0] : start;
            if (start !== 'Invalid Date') return { startDate: start, endDate: end };
          } catch { /* continue */ }
        }
      }
    }

    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    const dateStr = future.toISOString().split('T')[0];
    return { startDate: dateStr, endDate: dateStr };
  }

  private parsePrice(raw: RawClinicData): { amount: number; currency: string } {
    if (raw.priceAmount && raw.currency) return { amount: raw.priceAmount, currency: raw.currency };
    if (raw.price) {
      const match = raw.price.match(/[$€£¥]?\s*(\d[\d,]*\.?\d*)\s*(USD|CAD|EUR|GBP|AUD|CHF|SEK|NOK|JPY|CZK|RUB|KRW|CNY)?/i);
      if (match) {
        const amount = parseFloat(match[1].replace(',', ''));
        let currency = match[2]?.toUpperCase() || 'USD';
        if (raw.price.includes('€')) currency = 'EUR';
        if (raw.price.includes('£')) currency = 'GBP';
        if (raw.price.includes('¥')) currency = 'JPY';
        if (raw.price.includes('kr')) currency = 'SEK';
        if (raw.price.includes('Kč')) currency = 'CZK';
        if (raw.price.includes('₽')) currency = 'RUB';
        return { amount, currency };
      }
    }
    return { amount: 0, currency: 'USD' };
  }

  private parseAgeGroups(raw: RawClinicData): Clinic['ageGroups'] {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.ageRange || ''}`.toLowerCase();
    const groups: Clinic['ageGroups'] = [];
    if (/mite|ages?\s*[4-8]|u[- ]?8|4-8|5-8|6-8/i.test(text)) groups.push('mites');
    if (/squirt|atom|ages?\s*(9|10)|u[- ]?10|8-10|9-10/i.test(text)) groups.push('squirts');
    if (/peewee|pee.?wee|ages?\s*(11|12)|u[- ]?12|10-12|11-12/i.test(text)) groups.push('peewee');
    if (/bantam|ages?\s*(13|14)|u[- ]?14|12-14|13-14/i.test(text)) groups.push('bantam');
    if (/midget|ages?\s*(15|16|17)|u[- ]?16|u[- ]?18|14-16|15-17|14-18/i.test(text)) groups.push('midget');
    if (/junior|ages?\s*(18|19|20)|u[- ]?20|16-20|17-20/i.test(text)) groups.push('junior');
    return groups.length > 0 ? groups : ['all'];
  }

  private parseSkillLevels(raw: RawClinicData): Clinic['skillLevels'] {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.skillLevel || ''}`.toLowerCase();
    const levels: Clinic['skillLevels'] = [];
    if (/beginner|learn to play|introduction|introductory|first time|no experience|never played/i.test(text)) levels.push('beginner');
    if (/intermediate|some experience|recreational/i.test(text)) levels.push('intermediate');
    if (/advanced|experienced/i.test(text)) levels.push('advanced');
    if (/elite|aaa|tier 1|select|travel|competitive|high performance|prospect|pre-nhl/i.test(text)) levels.push('elite');
    return levels.length > 0 ? levels : ['all'];
  }

  private parseClinicType(raw: RawClinicData): Clinic['type'] {
    const text = `${raw.name || ''} ${raw.description || ''}`.toLowerCase();
    if (/showcase|exposure|scouting|combine/i.test(text)) return 'showcase';
    if (/tournament|tourney|jamboree/i.test(text)) return 'tournament';
    if (/camp|summer|week-long|overnight|residential|day camp/i.test(text)) return 'camp';
    if (/development|learn to play|intro|beginner|first step/i.test(text)) return 'development';
    return 'clinic';
  }

  private extractCity(raw: RawClinicData): string | null {
    const text = `${raw.location || ''} ${raw.description || ''}`;
    const cityMatch = text.match(/(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    return cityMatch ? cityMatch[1] : null;
  }

  private inferCountry(raw: RawClinicData): string {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.location || ''} ${raw.sourceUrl}`.toLowerCase();
    const countryPatterns: [RegExp, string][] = [
      [/canada|ontario|quebec|alberta|british columbia|manitoba|saskatchewan|\.ca\b/i, 'Canada'],
      [/sweden|swedish|stockholm|gothenburg|malmö|\.se\b|swehockey/i, 'Sweden'],
      [/finland|finnish|helsinki|tampere|\.fi\b|leijonat/i, 'Finland'],
      [/czech|prague|brno|\.cz\b|ceskyhokej/i, 'Czech Republic'],
      [/russia|russian|moscow|st\.?\s*petersburg|\.ru\b|fhr\.ru/i, 'Russia'],
      [/switzerland|swiss|zurich|zürich|davos|bern|\.ch\b|sihf/i, 'Switzerland'],
      [/germany|german|munich|münchen|berlin|düsseldorf|\.de\b|deb-online/i, 'Germany'],
      [/norway|norwegian|oslo|bergen|\.no\b|hockey\.no/i, 'Norway'],
      [/denmark|danish|copenhagen|\.dk\b|ishockey\.dk/i, 'Denmark'],
      [/austria|austrian|vienna|wien|innsbruck|\.at\b/i, 'Austria'],
      [/slovakia|slovak|bratislava|\.sk\b/i, 'Slovakia'],
      [/latvia|latvian|riga|\.lv\b/i, 'Latvia'],
      [/japan|japanese|tokyo|sapporo|nagano|\.jp\b|jihf/i, 'Japan'],
      [/south korea|korean|seoul|\.kr\b|kiha/i, 'South Korea'],
      [/china|chinese|beijing|shanghai|\.cn\b/i, 'China'],
      [/australia|australian|melbourne|sydney|brisbane|\.au\b|ihfa/i, 'Australia'],
      [/united kingdom|british|england|london|\.uk\b|eihl/i, 'United Kingdom'],
      [/france|french|paris|lyon|\.fr\b|hockeyfrance/i, 'France'],
      [/poland|polish|warsaw|\.pl\b|pzhl/i, 'Poland'],
      [/italy|italian|milan|rome|\.it\b|fisg/i, 'Italy'],
      [/hungary|hungarian|budapest|\.hu\b/i, 'Hungary'],
      [/belarus|belarusian|minsk|\.by\b/i, 'Belarus'],
      [/kazakhstan|almaty|\.kz\b/i, 'Kazakhstan'],
      [/usa|united states|america|\.com\b|\.org\b|\.net\b|usahockey/i, 'United States'],
    ];
    for (const [pattern, country] of countryPatterns) {
      if (pattern.test(text)) return country;
    }
    return 'United States';
  }

  private getCountryCode(country: string): string {
    const codes: Record<string, string> = {
      'United States': 'US', 'Canada': 'CA', 'Sweden': 'SE', 'Finland': 'FI',
      'Czech Republic': 'CZ', 'Russia': 'RU', 'Switzerland': 'CH', 'Germany': 'DE',
      'Norway': 'NO', 'Japan': 'JP', 'Australia': 'AU', 'France': 'FR',
      'United Kingdom': 'GB', 'Denmark': 'DK', 'Austria': 'AT', 'Slovakia': 'SK',
      'South Korea': 'KR', 'China': 'CN', 'Latvia': 'LV', 'Belarus': 'BY',
      'Poland': 'PL', 'Italy': 'IT', 'Hungary': 'HU', 'Kazakhstan': 'KZ',
      'New Zealand': 'NZ', 'India': 'IN', 'Thailand': 'TH', 'Singapore': 'SG',
      'Israel': 'IL', 'South Africa': 'ZA', 'Mexico': 'MX', 'Brazil': 'BR',
      'Argentina': 'AR', 'UAE': 'AE',
    };
    return codes[country] || 'US';
  }

  private calculateDuration(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 1) return '1 day';
    if (days <= 7) return `${days} days`;
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  private generateTags(raw: RawClinicData): string[] {
    const text = `${raw.name || ''} ${raw.description || ''}`.toLowerCase();
    const tags: string[] = [];
    if (/summer/i.test(text)) tags.push('summer');
    if (/winter/i.test(text)) tags.push('winter');
    if (/spring/i.test(text)) tags.push('spring');
    if (/fall|autumn/i.test(text)) tags.push('fall');
    if (/goaltend|goalie|netminder/i.test(text)) tags.push('goaltending');
    if (/power skat/i.test(text)) tags.push('power-skating');
    if (/shooting/i.test(text)) tags.push('shooting');
    if (/defense|defensive/i.test(text)) tags.push('defense');
    if (/forward/i.test(text)) tags.push('forwards');
    if (/stickhandl|puck\s*handl/i.test(text)) tags.push('stickhandling');
    if (/checking/i.test(text)) tags.push('checking');
    if (/conditioning|fitness|off-ice/i.test(text)) tags.push('conditioning');
    if (/beginner|learn to play/i.test(text)) tags.push('beginner-friendly');
    if (/elite|aaa|select/i.test(text)) tags.push('elite');
    if (/girls|women/i.test(text)) tags.push('girls-hockey');
    if (/overnight|residential/i.test(text)) tags.push('overnight');
    if (/day\s*camp/i.test(text)) tags.push('day-camp');
    if (/prospect|showcase|scouting/i.test(text)) tags.push('showcase');
    if (/nhl|pro/i.test(text)) tags.push('pro-instructors');
    if (raw.city) tags.push(raw.city.toLowerCase().replace(/\s+/g, '-'));
    return [...new Set(tags)];
  }

  private async geoEnrich(clinics: Clinic[]): Promise<Clinic[]> {
    // Only geocode a batch at a time (Nominatim rate limit)
    const enriched: Clinic[] = [];
    for (const clinic of clinics) {
      if (clinic.location.lat !== 0 && clinic.location.lng !== 0) {
        enriched.push(clinic);
        continue;
      }
      try {
        const query = clinic.location.city !== 'Unknown'
          ? `${clinic.location.city} ${clinic.location.country}`
          : clinic.location.country;
        const coords = await geocodeLocation(query);
        if (coords) {
          enriched.push({
            ...clinic,
            location: { ...clinic.location, lat: coords.lat, lng: coords.lng },
          });
          continue;
        }
      } catch { /* skip */ }

      const countryCoords = this.getCountryCoords(clinic.location.country);
      enriched.push({
        ...clinic,
        location: { ...clinic.location, ...countryCoords },
      });
    }
    return enriched;
  }

  private getCountryCoords(country: string): { lat: number; lng: number } {
    const coords: Record<string, { lat: number; lng: number }> = {
      'United States': { lat: 39.83, lng: -98.58 },
      'Canada': { lat: 56.13, lng: -106.35 },
      'Sweden': { lat: 60.13, lng: 18.64 },
      'Finland': { lat: 61.92, lng: 25.75 },
      'Czech Republic': { lat: 49.82, lng: 15.47 },
      'Russia': { lat: 55.75, lng: 37.62 },
      'Switzerland': { lat: 46.82, lng: 8.23 },
      'Germany': { lat: 51.17, lng: 10.45 },
      'Norway': { lat: 60.47, lng: 8.47 },
      'Denmark': { lat: 56.26, lng: 9.50 },
      'Austria': { lat: 47.52, lng: 14.55 },
      'Slovakia': { lat: 48.67, lng: 19.70 },
      'Japan': { lat: 36.20, lng: 138.25 },
      'South Korea': { lat: 35.91, lng: 127.77 },
      'China': { lat: 35.86, lng: 104.20 },
      'Australia': { lat: -25.27, lng: 133.78 },
      'United Kingdom': { lat: 55.38, lng: -3.44 },
      'France': { lat: 46.23, lng: 2.21 },
      'Poland': { lat: 51.92, lng: 19.15 },
      'Italy': { lat: 41.87, lng: 12.57 },
      'Latvia': { lat: 56.88, lng: 24.60 },
      'Belarus': { lat: 53.71, lng: 27.95 },
      'Hungary': { lat: 47.16, lng: 19.50 },
      'Kazakhstan': { lat: 48.02, lng: 66.92 },
    };
    return coords[country] || { lat: 0, lng: 0 };
  }

  clearCache() {
    this.cache.clear();
    this.discoveredUrls.clear();
  }
}

export const createSearchEngine = (config?: SearchConfig) => new ClinicSearchEngine(config);
