/**
 * Clinic Deduplication Engine
 *
 * Uses fuzzy string matching, location proximity, and date overlap
 * to identify and merge duplicate clinic entries that may have been
 * discovered from different sources.
 */

import { Clinic } from '@/types';

/**
 * Deduplicate clinics using multiple signals
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

  // Merge each group into a single "best" clinic
  return groups.map(mergeDuplicates);
}

/**
 * Determine if two clinics are likely the same event
 */
function areDuplicates(a: Clinic, b: Clinic): boolean {
  let score = 0;

  // 1. Name similarity (most important)
  const nameSim = stringSimilarity(
    normalize(a.name),
    normalize(b.name)
  );
  if (nameSim > 0.8) score += 2;
  else if (nameSim > 0.6) score += 1;

  // 2. Same dates
  if (a.dates.start === b.dates.start && a.dates.end === b.dates.end) {
    score += 1;
  } else if (a.dates.start === b.dates.start || a.dates.end === b.dates.end) {
    score += 0.5;
  }

  // 3. Same city/location
  if (
    normalize(a.location.city) === normalize(b.location.city) &&
    a.location.city !== 'unknown'
  ) {
    score += 0.5;
  }

  // 4. Same source URL domain
  if (getDomain(a.websiteUrl) === getDomain(b.websiteUrl)) {
    score += 0.5;
  }

  // Need at least 2.5 out of 4 to be considered a duplicate
  return score >= 2.5;
}

/**
 * Merge a group of duplicate clinics into the most complete one
 */
function mergeDuplicates(group: Clinic[]): Clinic {
  if (group.length === 1) return group[0];

  // Sort by completeness (most fields filled)
  const sorted = group.sort((a, b) => completenessScore(b) - completenessScore(a));

  // Take the most complete as base and fill gaps from others
  const base = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];

    // Fill in any missing fields
    if (!base.description && other.description) base.description = other.description;
    if (!base.longDescription && other.longDescription) base.longDescription = other.longDescription;
    if (!base.imageUrl && other.imageUrl) base.imageUrl = other.imageUrl;
    if (base.location.lat === 0 && other.location.lat !== 0) {
      base.location = { ...base.location, lat: other.location.lat, lng: other.location.lng };
    }
    if (!base.contactEmail && other.contactEmail) base.contactEmail = other.contactEmail;
    if (!base.contactPhone && other.contactPhone) base.contactPhone = other.contactPhone;
    if (base.coaches.length === 0 && other.coaches.length > 0) base.coaches = other.coaches;
    if (base.price.amount === 0 && other.price.amount > 0) base.price = other.price;
    if (base.ageGroups.includes('all') && !other.ageGroups.includes('all')) {
      base.ageGroups = other.ageGroups;
    }
    if (base.skillLevels.includes('all') && !other.skillLevels.includes('all')) {
      base.skillLevels = other.skillLevels;
    }

    // Merge gallery images
    const allImages = new Set([...base.galleryUrls, ...other.galleryUrls]);
    base.galleryUrls = Array.from(allImages);

    // Merge tags
    const allTags = new Set([...base.tags, ...other.tags]);
    base.tags = Array.from(allTags);

    // Merge amenities
    const allAmenities = new Set([...base.amenities, ...other.amenities]);
    base.amenities = Array.from(allAmenities);

    // Take higher confidence/rating
    if (other.featured && !base.featured) base.featured = true;
    if (other.rating > base.rating) base.rating = other.rating;
  }

  return base;
}

/**
 * Calculate how complete a clinic entry is (0-1)
 */
function completenessScore(clinic: Clinic): number {
  let score = 0;
  const fields = [
    clinic.name,
    clinic.description,
    clinic.longDescription,
    clinic.imageUrl,
    clinic.location.venue !== 'Venue TBD',
    clinic.location.city !== 'Unknown',
    clinic.location.lat !== 0,
    clinic.contactEmail,
    clinic.contactPhone,
    clinic.coaches.length > 0,
    clinic.price.amount > 0,
    !clinic.ageGroups.includes('all'),
    !clinic.skillLevels.includes('all'),
    clinic.amenities.length > 0,
    clinic.schedule.length > 0,
  ];

  for (const field of fields) {
    if (field) score++;
  }

  return score / fields.length;
}

/**
 * Fuzzy string similarity (Sørensen–Dice coefficient on bigrams)
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
  }

  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
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
