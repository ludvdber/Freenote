import type { ReportResolution, ReportType } from '@/types';

/**
 * Métadonnées d'affichage des signalements — module PUR (aucun import React/MUI) pour rester
 * testable et utilisable des deux côtés : le formulaire de signalement de la page document et la
 * file de modération.
 *
 * L'ordre du tableau est l'ordre d'affichage PARTOUT (formulaire et chips de filtre) : du plus
 * urgent pour la modération au plus anodin. Doit rester synchro avec l'enum `ReportType` du
 * backend (`be.freenote.enums.ReportType`) ; un type inconnu retombe sur AUTRE des deux côtés.
 */
export interface ReportTypeMeta {
  id: ReportType;
  emoji: string;
  /** Couleur sémantique MUI — pas de nouvelle palette à maintenir, correct en clair comme en sombre. */
  color: 'error' | 'warning' | 'info' | 'default';
}

export const REPORT_TYPES: readonly ReportTypeMeta[] = [
  { id: 'SUPPRESSION', emoji: '🗑️', color: 'error' },
  { id: 'INAPPROPRIE', emoji: '🚫', color: 'error' },
  { id: 'ERREUR', emoji: '❌', color: 'warning' },
  { id: 'OBSOLETE', emoji: '🕰️', color: 'warning' },
  { id: 'METADONNEES', emoji: '🏷️', color: 'info' },
  { id: 'AMELIORATION', emoji: '✨', color: 'info' },
  { id: 'DOUBLON', emoji: '📑', color: 'default' },
  { id: 'AUTRE', emoji: '💬', color: 'default' },
] as const;

const FALLBACK: ReportTypeMeta = REPORT_TYPES[REPORT_TYPES.length - 1];

/** Jamais undefined : une valeur inconnue (client plus ancien, donnée héritée) rend le chip AUTRE. */
export function reportTypeMeta(type: string | null | undefined): ReportTypeMeta {
  return REPORT_TYPES.find((r) => r.id === type) ?? FALLBACK;
}

/**
 * Résolutions proposées dans le dialogue « Traiter ». `acts` = le serveur touche VRAIMENT au
 * document — c'est ce qui distingue une décision d'un simple rangement de la file, et ce qui
 * justifie une confirmation dans l'UI.
 */
export interface ResolutionMeta {
  id: ReportResolution;
  emoji: string;
  acts: boolean;
  /** Vrai pour l'action irréversible : le dialogue exige une confirmation explicite. */
  destructive?: boolean;
}

export const RESOLUTIONS: readonly ResolutionMeta[] = [
  { id: 'EDITED', emoji: '✏️', acts: false },
  { id: 'UNVERIFIED', emoji: '⭐', acts: true },
  { id: 'DELETED', emoji: '🗑️', acts: true, destructive: true },
  { id: 'NO_ACTION', emoji: '👌', acts: false },
] as const;

/**
 * Résolution suggérée par défaut selon le type signalé — l'admin ouvre le dialogue sur le choix
 * le plus probable au lieu d'un formulaire vide. Jamais DELETED : une suppression se décide,
 * elle ne se pré-coche pas.
 */
export function suggestedResolution(type: string | null | undefined): ReportResolution {
  switch (type) {
    case 'METADONNEES':
    case 'AMELIORATION':
      return 'EDITED';
    case 'OBSOLETE':
    case 'ERREUR':
    case 'DOUBLON':
      return 'UNVERIFIED';
    default:
      return 'NO_ACTION';
  }
}
