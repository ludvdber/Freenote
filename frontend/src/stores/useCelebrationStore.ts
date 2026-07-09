import { create } from 'zustand';
import type { Level } from '@/lib/levels';

/**
 * Moments de célébration (maquette « Moments de lumière » validée 2026-07-09) :
 * toast « document vérifié » (+10 XP) déclenché par l'événement SSE, et modal de passage
 * de palier déclenchée par useLevelCelebration quand l'XP du store franchit un seuil.
 * Pattern useAuthPromptStore : le store est global, <CelebrationLayer> est monté une fois dans App.
 */

interface VerifiedToast {
  title: string;
  xp: number;
}

interface CelebrationState {
  toast: VerifiedToast | null;
  levelUp: Level | null;
  showToast: (toast: VerifiedToast) => void;
  dismissToast: () => void;
  showLevelUp: (level: Level) => void;
  dismissLevelUp: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set) => ({
  toast: null,
  levelUp: null,
  showToast: (toast) => set({ toast }),
  dismissToast: () => set({ toast: null }),
  showLevelUp: (levelUp) => set({ levelUp }),
  dismissLevelUp: () => set({ levelUp: null }),
}));
