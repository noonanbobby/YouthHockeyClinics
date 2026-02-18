/**
 * Clinic Deduplication Engine
 *
 * Uses fuzzy string matching, location proximity, and date overlap
 * to identify and merge duplicate clinic entries that may have been
 * discovered from different sources.
 */

import { Clinic } from '@/types';

/**
 * Deduplicate clinics using multiple signals.
 */
export function deduplicateClinics(clinics: Clinic[]): Clinic[] {
  if (clinics.length === 0) return [];

  const groups: Clinic[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < clinics.length; i++) {
    if (used.has(i)) continue;

    const group: Clinic[] = [clinics[i]];
    used.add(i);

    for (let j = i + 1; j < clinics.length; j++) {
      if (used.has(j)) continue;
      if (areDuplicates(clinics[i], clinics[j])) {
        group.push(clinics[j]);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups.map(mergeDuplicates);
}

/**
 * Determine if two clinics are likely the same event.
 */
function areDuplicates(a: Clinic, b: Clinic): boolean {
  let score = 0;

  // 1. Name similarity (most important signal)
  const nameSim = stringSimilarity(normalize(a.name), normalize(b.name));
  if (nameSim > 0.8) score += 2;
  else if (nameSim > 0.6) score += 1;

  // 2. Same dates
  if (
    a.dates?.start === b.dates?.start &&
    a.dates?.end === b.dates?.end
  ) {
    score += 1;
  } else if (
    a.dates?.start === b.dates?.start ||
    a.dates?.end === b.dates?.end
  ) {
    score += 0.5;
  }

  // 3. Same city
  const cityA = normalize(a.location?.city ?? '');
  const cityB = normalize(b.location?.city ?? '');
  if (cityA && cityA !== 'unknown' && cityA === cityB) {
    score += 0.5;
  }

  // 4. Same source URL domain
  const domainA = getDomain(a.websiteUrl ?? '');
  const domainB = getDomain(b.websiteUrl ?? '');
  if (domainA && domainA === domainB) {
    score += 0.5;
  }

  // Need at least 2.5 out of 4 to be considered a duplicate
  return score >= 2.5;
}

/**
 * Merge a group of duplicate clinics into the most complete one.
 */
function mergeDuplicates(group: Clinic[]): Clinic {
  if (group.length === 1) return group[0];

  // Sort by completeness — most complete entry becomes the base
  const sorted = [...group].sort(
    (a, b) => completenessScore(b) - completenessScore(a),
  );

  const base: Clinic = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];

    // Fill missing scalar fields
    if (!base.description && other.description)
      base.description = other.description;
    if (!base.longDescription && other.longDescription)
      base.longDescription = other.longDescription;
    if (!base.imageUrl && other.imageUrl) base.imageUrl = other.imageUrl;
    if (!base.contactEmail && other.contactEmail)
      base.contactEmail = other.contactEmail;
    if (!base.contactPhone && other.contactPhone)
      base.contactPhone = other.contactPhone;

    // Fill missing location coordinates
    if (
      base.location.lat === 0 &&
      base.location.lng === 0 &&
      (other.location?.lat ?? 0) !== 0
    ) {
      base.location = {
        ...base.location,
        lat: other.location.lat,
        lng: other.location.lng,
      };
    }

    // Fill missing coaches
    const baseCoaches = base.coaches ?? [];
    const otherCoaches = other.coaches ?? [];
    if (baseCoaches.length === 0 && otherCoaches.length > 0) {
      base.coaches = otherCoaches;
    }

    // Fill missing price
    if (
      (base.price?.amount ?? 0) === 0 &&
      (other.price?.amount ?? 0) > 0
    ) {
      base.price = other.price;
    }

    // Prefer specific age groups over 'all'
    const baseAges = base.ageGroups ?? [];
    const otherAges = other.ageGroups ?? [];
    if (
      baseAges.length === 1 &&
      baseAges[0] === 'all' &&
      !(otherAges.length === 1 && otherAges[0] === 'all')
    ) {
      base.ageGroups = otherAges;
    }

    // Prefer specific skill levels over 'all'
    const baseSkills = base.skillLevels ?? [];
    const otherSkills = other.skillLevels ?? [];
    if (
      baseSkills.length === 1 &&
      baseSkills[0] === 'all' &&
      !(otherSkills.length === 1 && otherSkills[0] === 'all')
    ) {
      base.skillLevels = otherSkills;
    }

    // Merge gallery images (deduplicated)
    const allImages = new Set([
      ...(base.galleryUrls ?? []),
      ...(other.galleryUrls ?? []),
    ]);
    base.galleryUrls = Array.from(allImages);

    // Merge tags (deduplicated)
    const allTags = new Set([...(base.tags ?? []), ...(other.tags ?? [])]);
    base.tags = Array.from(allTags);

    // Merge amenities (deduplicated)
    const allAmenities = new Set([
      ...(base.amenities ?? []),
      ...(other.amenities ?? []),
    ]);
    base.amenities = Array.from(allAmenities);

    // Prefer featured
    if (other.featured && !base.featured) base.featured = true;

    // Take higher rating
    if ((other.rating ?? 0) > (base.rating ?? 0)) base.rating = other.rating;
  }

  return base;
}

/**
 * Calculate how complete a clinic entry is (higher = more complete).
 */
function completenessScore(clinic: Clinic): number {
  let score = 0;

  if (clinic.name) score++;
  if (clinic.description) score++;
  if (clinic.longDescription) score++;
  if (clinic.imageUrl) score++;
  if (clinic.location?.venue && clinic.location.venue !== 'Venue TBD') score++;
  if (clinic.location?.city && clinic.location.city !== 'Unknown') score++;
  if ((clinic.location?.lat ?? 0) !== 0) score++;
  if (clinic.contactEmail) score++;
  if (clinic.contactPhone) score++;
  if ((clinic.coaches?.length ?? 0) > 0) score++;
  if ((clinic.price?.amount ?? 0) > 0) score++;
  if (
    (clinic.ageGroups?.length ?? 0) > 0 &&
    clinic.ageGroups?.[0] !== 'all'
  )
    score++;
  if (
    (clinic.skillLevels?.length ?? 0) > 0 &&
    clinic.skillLevels?.[0] !== 'all'
  )
    score++;
  if ((clinic.amenities?.length ?? 0) > 0) score++;
  if ((clinic.schedule?.length ?? 0) > 0) score++;

  return score;
}

/**
 * Fuzzy string similarity using the Sørensen–Dice coefficient on bigrams.
 * Returns a value between 0 (no similarity) and 1 (identical).
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) ?? 0) + 1);
  }

  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2);
    const count = bigramsA.get(bigram);
    if (count && count > 0) {
      bigramsA.set(bigram, count - 1);
      intersect++;
    }
  }

  return (2 * intersect) / (a.length + b.length - 2);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
