import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCelebrationStore } from '@/stores/useCelebrationStore';
import { LEVELS, levelFor } from '@/lib/levels';

/**
 * Détecteur de passage de palier : observe l'XP du store auth et célèbre (une seule fois)
 * quand le palier monte. Le dernier palier vu est persisté par utilisateur dans localStorage —
 * première connexion sur cet appareil = baseline silencieuse, jamais de célébration rétroactive.
 * Une baisse d'XP (doc supprimé → XP repris) resynchronise sans rien afficher.
 */
export function useLevelCelebration() {
  const userId = useAuthStore((s) => s.user?.id);
  const xp = useAuthStore((s) => s.user?.xp);
  const showLevelUp = useCelebrationStore((s) => s.showLevelUp);

  useEffect(() => {
    if (userId == null || typeof xp !== 'number') return;
    const key = `freenote-level:${userId}`;
    const level = levelFor(xp);
    const idx = LEVELS.indexOf(level);
    const prevRaw = localStorage.getItem(key);
    if (prevRaw === null) {
      localStorage.setItem(key, String(idx));
      return;
    }
    const prev = Number(prevRaw);
    if (idx > prev) {
      localStorage.setItem(key, String(idx));
      showLevelUp(level);
    } else if (idx < prev) {
      localStorage.setItem(key, String(idx));
    }
  }, [userId, xp, showLevelUp]);
}
