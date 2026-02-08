'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { sendLocalNotification } from '@/hooks/useServiceWorker';

/**
 * Notification engine that runs periodic checks and generates contextual alerts:
 * - Registration reminders (1 day, 3 days, 7 days before)
 * - New clinic matching child's age group
 * - Spots running low on favorited clinics
 * - Price drop detection (compares to previous scan)
 */
export function useNotificationEngine() {
  const {
    registrations,
    clinics,
    childProfiles,
    activeChildId,
    favoriteIds,
    notificationsEnabled,
    notifications,
    addNotification,
    getActiveChildAgeGroup,
  } = useStore();

  const lastCheckRef = useRef<number>(0);
  const sentRemindersRef = useRef<Set<string>>(new Set());
  const previousClinicsRef = useRef<Map<string, { price: number; spots: number }>>(new Map());

  useEffect(() => {
    if (!notificationsEnabled) return;

    const check = () => {
      const now = Date.now();
      // Don't check more than once per minute
      if (now - lastCheckRef.current < 60000) return;
      lastCheckRef.current = now;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // ── REGISTRATION REMINDERS ────────────────────────
      for (const reg of registrations) {
        if (reg.status === 'cancelled') continue;
        const startDate = new Date(reg.startDate);
        const daysUntil = Math.floor((startDate.getTime() - today.getTime()) / (86400000));

        for (const reminderDay of [7, 3, 1]) {
          if (daysUntil === reminderDay) {
            const key = `reminder-${reg.id}-${reminderDay}d`;
            if (!sentRemindersRef.current.has(key)) {
              sentRemindersRef.current.add(key);
              const alreadyNotified = notifications.some(
                (n) => n.type === 'registration_reminder' && n.body.includes(reg.clinicName) && n.body.includes(`${reminderDay} day`)
              );
              if (!alreadyNotified) {
                addNotification({
                  title: reminderDay === 1 ? 'Tomorrow!' : `${reminderDay} Days Away`,
                  body: `${reg.clinicName} ${reminderDay === 1 ? 'is tomorrow' : `starts in ${reminderDay} days`}${reg.playerName ? ` — ${reg.playerName}` : ''}`,
                  clinicId: reg.clinicId,
                  type: 'registration_reminder',
                });
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  sendLocalNotification(
                    reminderDay === 1 ? 'Tomorrow!' : `${reminderDay} Days Away`,
                    `${reg.clinicName} ${reminderDay === 1 ? 'is tomorrow' : `starts in ${reminderDay} days`}`
                  );
                }
              }
            }
          }
        }
      }

      // ── SPOTS LOW ON FAVORITES ────────────────────────
      for (const clinic of clinics) {
        if (!favoriteIds.includes(clinic.id)) continue;
        const prev = previousClinicsRef.current.get(clinic.id);
        if (prev) {
          // Spots dropping low (under 5 and was higher before)
          if (clinic.spotsRemaining <= 5 && clinic.spotsRemaining > 0 && prev.spots > 5) {
            const key = `spots-low-${clinic.id}-${todayStr}`;
            if (!sentRemindersRef.current.has(key)) {
              sentRemindersRef.current.add(key);
              addNotification({
                title: 'Spots Running Low!',
                body: `Only ${clinic.spotsRemaining} spots left for ${clinic.name}`,
                clinicId: clinic.id,
                type: 'spots_low',
              });
            }
          }

          // Price drop detection
          if (clinic.price.amount > 0 && prev.price > 0 && clinic.price.amount < prev.price) {
            const savings = prev.price - clinic.price.amount;
            const key = `price-drop-${clinic.id}-${clinic.price.amount}`;
            if (!sentRemindersRef.current.has(key)) {
              sentRemindersRef.current.add(key);
              addNotification({
                title: 'Price Drop!',
                body: `${clinic.name} dropped $${savings} — now $${clinic.price.amount}`,
                clinicId: clinic.id,
                type: 'price_drop',
              });
            }
          }
        }
      }

      // Store current clinic data for next comparison
      for (const c of clinics) {
        previousClinicsRef.current.set(c.id, { price: c.price.amount, spots: c.spotsRemaining });
      }

      // ── CHILD AGE GROUP MATCH ────────────────────────
      const activeAg = getActiveChildAgeGroup();
      const activeChild = childProfiles.find((c) => c.id === activeChildId);
      if (activeAg && activeChild) {
        const matchingClinics = clinics.filter(
          (c) =>
            (c.ageGroups.includes(activeAg) || c.ageGroups.includes('all')) &&
            c.spotsRemaining > 0 &&
            c.dates.start >= todayStr
        );

        // Only notify about clinics not already notified
        for (const mc of matchingClinics.slice(0, 2)) {
          const key = `child-match-${activeChild.id}-${mc.id}`;
          if (!sentRemindersRef.current.has(key)) {
            const alreadyNotified = notifications.some(
              (n) => n.type === 'child_match' && n.clinicId === mc.id
            );
            if (!alreadyNotified) {
              sentRemindersRef.current.add(key);
              // Don't double-notify — setClinics already handles new clinic matches
            }
          }
        }
      }
    };

    // Run check immediately
    check();

    // Then every 5 minutes
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [
    registrations,
    clinics,
    childProfiles,
    activeChildId,
    favoriteIds,
    notificationsEnabled,
    notifications,
    addNotification,
    getActiveChildAgeGroup,
  ]);
}
