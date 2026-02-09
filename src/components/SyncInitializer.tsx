'use client';

import { useSync } from '@/hooks/useSync';

export function SyncInitializer() {
  useSync();
  return null;
}
