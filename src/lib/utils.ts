import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { AgeGroup, ClinicType, SkillLevel } from '@/types';

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d');
}

export function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) {
    return format(s, 'MMMM d, yyyy');
  }
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${format(s, 'MMMM d')} - ${format(e, 'd, yyyy')}`;
  }
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, 'MMM d')} - ${format(e, 'MMM d, yyyy')}`;
  }
  return `${format(s, 'MMM d, yyyy')} - ${format(e, 'MMM d, yyyy')}`;
}

export function timeUntil(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isBefore(date, new Date())) return 'Started';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function isUpcoming(dateStr: string): boolean {
  return isAfter(parseISO(dateStr), new Date());
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getAgeGroupLabel(ag: AgeGroup): string {
  const labels: Record<AgeGroup, string> = {
    mites: 'Mites (6-8)',
    squirts: 'Squirts (9-10)',
    peewee: 'PeeWee (11-12)',
    bantam: 'Bantam (13-14)',
    midget: 'Midget (15-17)',
    junior: 'Junior (18-20)',
    all: 'All Ages',
  };
  return labels[ag];
}

export function getSkillLevelLabel(sl: SkillLevel): string {
  const labels: Record<SkillLevel, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    elite: 'Elite',
    all: 'All Levels',
  };
  return labels[sl];
}

export function getClinicTypeLabel(ct: ClinicType): string {
  const labels: Record<ClinicType, string> = {
    camp: 'Camp',
    clinic: 'Clinic',
    tournament: 'Tournament',
    showcase: 'Showcase',
    development: 'Development',
  };
  return labels[ct];
}

export function getClinicTypeColor(ct: ClinicType): string {
  const colors: Record<ClinicType, string> = {
    camp: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    clinic: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    tournament: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    showcase: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    development: 'bg-green-500/20 text-green-300 border-green-500/30',
  };
  return colors[ct];
}

export function getSpotsColor(spots: number, max: number): string {
  const ratio = spots / max;
  if (ratio <= 0.1) return 'text-red-400';
  if (ratio <= 0.3) return 'text-orange-400';
  return 'text-green-400';
}

export function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
